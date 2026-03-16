'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { VoiceSession, VoiceEvent, VoiceSessionConfig } from '../services/voiceSession';

export interface UseVoiceSessionReturn {
  /** Start the voice session */
  startSession: () => Promise<void>;
  /** End the voice session */
  endSession: () => Promise<void>;
  /** Toggle microphone capture */
  toggleCapture: () => Promise<void>;
  /** Send text (fallback when mic unavailable) */
  sendText: (text: string) => void;
  /** Send a tool result back to Sonic */
  sendToolResult: (toolUseId: string, result: string | Record<string, unknown>) => void;
  /** Interrupt current playback */
  interrupt: (reason?: string) => void;
  /** Whether connected to the WebSocket */
  isConnected: boolean;
  /** Whether microphone is capturing */
  isCapturing: boolean;
  /** Current transcription from Sonic */
  transcript: string;
  /** Last text response */
  lastResponse: string;
  /** Last tool call info */
  lastToolCall: { name: string; input: Record<string, unknown>; toolUseId: string } | null;
  /** Voice events log (last 20) */
  eventLog: VoiceEvent[];
  /** Audio analyzer node for VAD */
  analyzer: AnalyserNode | null;
  /** Whether the session is grounded and ready for interaction */
  isGrounded: boolean;
  /** Whether the assistant is currently speaking */
  isSpeaking: boolean;
  /** Current error */
  error: string | null;
}

export function useVoiceSession(
  sessionId: string,
  options?: { memoryContext?: string; userGoal?: string }
): UseVoiceSessionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [lastToolCall, setLastToolCall] = useState<{ name: string; input: Record<string, unknown>; toolUseId: string } | null>(null);
  const [eventLog, setEventLog] = useState<VoiceEvent[]>([]);
  const [isGrounded, setIsGrounded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzer, setAnalyzer] = useState<AnalyserNode | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);

  const addEvent = useCallback((event: VoiceEvent) => {
    setEventLog((prev) => [...prev.slice(-19), event]);
  }, []);

  const startSession = useCallback(async () => {
    const identityPoolId = process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID;
    const bedrockRegion =
      process.env.NEXT_PUBLIC_BEDROCK_REGION || process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';
    const identityRegion =
      identityPoolId && identityPoolId.includes(':')
        ? identityPoolId.split(':')[0]
        : process.env.NEXT_PUBLIC_AWS_REGION || bedrockRegion;
    if (!identityPoolId) {
      setError('Cognito Identity Pool ID not configured (NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID)');
      return;
    }
    if (!bedrockRegion) {
      setError('Bedrock region not configured (NEXT_PUBLIC_BEDROCK_REGION or NEXT_PUBLIC_AWS_REGION)');
      return;
    }

    try {
      setError(null);

      const config: VoiceSessionConfig = {
        sessionId,
        bedrockRegion,
        identityRegion,
        identityPoolId,
        memoryContext: options?.memoryContext,
        userGoal: options?.userGoal,
      };

      const session = new VoiceSession(config);
      sessionRef.current = session;

      const appendWithSpace = (prev: string, next: string) => {
        if (!prev) return next;
        if (!next) return prev;
        const needsSpace = !/\s$/.test(prev) && !/^\s/.test(next);
        return needsSpace ? `${prev} ${next}` : `${prev}${next}`;
      };

      session.onEvent((event: VoiceEvent) => {
        addEvent(event);

        switch (event.type) {
          case 'connected':
            setIsConnected(true);
            break;

          case 'disconnected':
            setIsConnected(false);
            setIsCapturing(false);
            break;

          case 'sessionStarted':
            setIsGrounded(true);
            break;

          case 'text':
            if (event.text) {
              const text = event.text;
              setLastResponse((prev) => appendWithSpace(prev, text));
            }
            break;

          case 'transcript':
            if (event.text) {
              const text = event.text;
              setTranscript((prev) => appendWithSpace(prev, text));
            }
            break;

          case 'toolUse':
            if (event.toolName && event.toolUseId) {
              setLastToolCall({
                name: event.toolName,
                input: event.toolInput || {},
                toolUseId: event.toolUseId,
              });
            }
            break;

          case 'turnComplete':
            break;

          case 'error':
            setError(event.error || 'Unknown voice error');
            break;
        }
      });

      await session.connect();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start voice session');
    }
  }, [sessionId, addEvent, options]);

  const endSession = useCallback(async () => {
    if (sessionRef.current) {
      await sessionRef.current.disconnect();
      sessionRef.current = null;
    }
    setIsConnected(false);
    setIsCapturing(false);
    setIsGrounded(false);
  }, []);

  const toggleCapture = useCallback(async () => {
    if (!sessionRef.current) return;

    if (isCapturing) {
      sessionRef.current.stopCapture();
      setIsCapturing(false);
      setAnalyzer(null);
    } else {
      try {
        await sessionRef.current.startCapture();
        setIsCapturing(true);
        setAnalyzer(sessionRef.current.analyzerNode);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start microphone capture');
      }
    }
  }, [isCapturing]);

  const sendText = useCallback((text: string) => {
    if (sessionRef.current) {
      sessionRef.current.sendText(text);
    }
  }, []);

  const sendToolResult = useCallback((toolUseId: string, result: string | Record<string, unknown>) => {
    if (sessionRef.current) {
      sessionRef.current.sendToolResult(toolUseId, result);
    }
  }, []);

  const interrupt = useCallback((reason: string = 'manual') => {
    if (sessionRef.current) {
      sessionRef.current.interrupt(reason);
    }
  }, []);

  const lastInterruptRef = useRef<number>(0);

  // Barge-in check (VAD)
  useEffect(() => {
    if (!isCapturing || !analyzer || !isConnected) return;

    let rafVolume: number;
    let rafStatus: number;
    const buffer = new Uint8Array(analyzer.fftSize);
    const threshold = 50; // Simple threshold for barge-in

    const checkVolume = () => {
      if (analyzer && sessionRef.current) {
        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        analyzer.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;
        
        // Only barge-in if assistant is actually speaking and user is loud enough
        // This prevents ambient noise or the user's initial prompt from killing the AI's response turn
        const now = Date.now();
        if (sessionRef.current.isSpeaking && average > 60 && now - lastInterruptRef.current > 500) {
           console.info(`[useVoiceSession] VAD Barge-in detected (avg: ${Math.round(average)})`);
           lastInterruptRef.current = now;
           sessionRef.current.interrupt('vad_barge_in');
        }
      }
      rafVolume = requestAnimationFrame(checkVolume);
    };
    rafVolume = requestAnimationFrame(checkVolume);

    const checkStatus = () => {
      if (sessionRef.current) {
        setIsSpeaking(sessionRef.current.isSpeaking);
      }
      rafStatus = requestAnimationFrame(checkStatus);
    };
    rafStatus = requestAnimationFrame(checkStatus);

    return () => {
      cancelAnimationFrame(rafVolume);
      cancelAnimationFrame(rafStatus);
    };
  }, [isCapturing, analyzer, isConnected]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.disconnect().catch(console.error);
      }
    };
  }, []);

  return {
    startSession,
    endSession,
    toggleCapture,
    sendText,
    sendToolResult,
    interrupt,
    isConnected,
    isCapturing,
    isGrounded,
    isSpeaking,
    transcript,
    lastResponse,
    lastToolCall,
    eventLog,
    analyzer,
    error,
  };
}
