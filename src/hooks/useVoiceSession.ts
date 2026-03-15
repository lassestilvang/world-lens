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
  sendToolResult: (toolUseId: string, result: string) => void;
  /** Whether connected to the WebSocket */
  isConnected: boolean;
  /** Whether microphone is capturing */
  isCapturing: boolean;
  /** Current transcription from Sonic */
  transcript: string;
  /** Last text response */
  lastResponse: string;
  /** Last tool call info */
  lastToolCall: { name: string; input: Record<string, unknown> } | null;
  /** Voice events log (last 20) */
  eventLog: VoiceEvent[];
  /** Current error */
  error: string | null;
}

export function useVoiceSession(sessionId: string): UseVoiceSessionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [lastToolCall, setLastToolCall] = useState<{ name: string; input: Record<string, unknown> } | null>(null);
  const [eventLog, setEventLog] = useState<VoiceEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);

  const addEvent = useCallback((event: VoiceEvent) => {
    setEventLog((prev) => [...prev.slice(-19), event]);
  }, []);

  const startSession = useCallback(async () => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) {
      setError('WebSocket URL not configured (NEXT_PUBLIC_WS_URL)');
      return;
    }

    try {
      setError(null);

      const config: VoiceSessionConfig = {
        wsUrl,
        sessionId,
      };

      const session = new VoiceSession(config);
      sessionRef.current = session;

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
            // Session ready
            break;

          case 'text':
            if (event.text) {
              setTranscript((prev) => prev + event.text);
              setLastResponse(event.text);
            }
            break;

          case 'toolUse':
            if (event.toolName) {
              setLastToolCall({
                name: event.toolName,
                input: event.toolInput || {},
              });
            }
            break;

          case 'turnComplete':
            // Reset transcript for next turn
            setTranscript('');
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
  }, [sessionId, addEvent]);

  const endSession = useCallback(async () => {
    if (sessionRef.current) {
      await sessionRef.current.disconnect();
      sessionRef.current = null;
    }
    setIsConnected(false);
    setIsCapturing(false);
  }, []);

  const toggleCapture = useCallback(async () => {
    if (!sessionRef.current) return;

    if (isCapturing) {
      sessionRef.current.stopCapture();
      setIsCapturing(false);
    } else {
      try {
        await sessionRef.current.startCapture();
        setIsCapturing(true);
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

  const sendToolResult = useCallback((toolUseId: string, result: string) => {
    if (sessionRef.current) {
      sessionRef.current.sendToolResult(toolUseId, result);
    }
  }, []);

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
    isConnected,
    isCapturing,
    transcript,
    lastResponse,
    lastToolCall,
    eventLog,
    error,
  };
}
