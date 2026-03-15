'use client';

/**
 * VoiceSession — manages the WebSocket connection to the Nova Sonic voice pipeline.
 *
 * Handles:
 * - WebSocket lifecycle (connect, reconnect, disconnect)
 * - Audio capture from microphone (PCM 16-bit, 16kHz mono)
 * - Sending audio chunks to the Lambda → Sonic pipeline
 * - Receiving and playing audio response chunks
 * - Tool call events and transcript events
 */

export interface VoiceSessionConfig {
  wsUrl: string;
  sessionId: string;
  memoryContext?: string;
}

export type VoiceEventType =
  | 'connected'
  | 'disconnected'
  | 'sessionStarted'
  | 'sessionEnded'
  | 'audio'
  | 'text'
  | 'transcript'
  | 'toolUse'
  | 'turnComplete'
  | 'error';

export interface VoiceEvent {
  type: VoiceEventType;
  audio?: ArrayBuffer;
  text?: string;
  toolName?: string;
  toolUseId?: string;
  toolInput?: Record<string, unknown>;
  error?: string;
}

type VoiceEventCallback = (event: VoiceEvent) => void;

export class VoiceSession {
  private ws: WebSocket | null = null;
  private config: VoiceSessionConfig;
  private callbacks: VoiceEventCallback[] = [];
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | ScriptProcessorNode | null = null;
  private isCapturing = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;

  constructor(config: VoiceSessionConfig) {
    this.config = config;
  }

  /**
   * Register a callback for voice events.
   */
  onEvent(callback: VoiceEventCallback): void {
    this.callbacks.push(callback);
  }

  private emit(event: VoiceEvent): void {
    for (const cb of this.callbacks) {
      try {
        cb(event);
      } catch (err) {
        console.error('[VoiceSession] Callback error:', err);
      }
    }
  }

  /**
   * Connect to the WebSocket voice pipeline and start a Sonic session.
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.config.wsUrl}?sessionId=${encodeURIComponent(this.config.sessionId)}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[VoiceSession] WebSocket connected');
        this.reconnectAttempts = 0;
        this.emit({ type: 'connected' });

        // Start a Sonic session
        this.ws!.send(
          JSON.stringify({
            action: 'startSession',
            sessionId: this.config.sessionId,
            memoryContext: this.config.memoryContext,
          })
        );

        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          this.handleServerMessage(data);
        } catch (err) {
          console.error('[VoiceSession] Message parse error:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[VoiceSession] WebSocket error:', error);
        this.emit({ type: 'error', error: 'WebSocket connection error' });
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('[VoiceSession] WebSocket closed');
        this.emit({ type: 'disconnected' });
        this.stopCapture();

        // Auto-reconnect with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
          console.log(`[VoiceSession] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
          setTimeout(() => this.connect().catch(console.error), delay);
        }
      };
    });
  }

  /**
   * Handle incoming messages from the WebSocket server.
   */
  private handleServerMessage(data: Record<string, unknown>): void {
    const type = data.type as string;

    switch (type) {
      case 'sessionStarted':
        this.emit({ type: 'sessionStarted' });
        break;

      case 'sessionEnded':
        this.emit({ type: 'sessionEnded' });
        break;

      case 'audio': {
        // Decode and play audio
        if (data.audio) {
          const audioBytes = this.base64ToArrayBuffer(data.audio as string);
          this.playAudio(audioBytes);
          this.emit({ type: 'audio', audio: audioBytes });
        }
        break;
      }

      case 'text':
        this.emit({ type: 'text', text: data.text as string });
        break;

      case 'toolUse':
        this.emit({
          type: 'toolUse',
          toolName: data.toolName as string,
          toolUseId: data.toolUseId as string,
          toolInput: data.toolInput as Record<string, unknown>,
        });
        break;

      case 'turnComplete':
        this.emit({ type: 'turnComplete' });
        break;

      case 'error':
        this.emit({ type: 'error', error: data.error as string });
        break;
    }
  }

  /**
   * Start capturing microphone audio and streaming to the WebSocket.
   */
  async startCapture(): Promise<void> {
    if (this.isCapturing) return;

    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Use ScriptProcessor for wider browser compatibility (AudioWorklet preferred in production)
      const bufferSize = 4096;
      const processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
      this.workletNode = processor;

      processor.onaudioprocess = (event) => {
        if (!this.isCapturing || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = event.inputBuffer.getChannelData(0);

        // Convert Float32 [-1, 1] to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Send as base64-encoded audio
        const base64 = this.arrayBufferToBase64(pcmData.buffer);
        this.ws.send(
          JSON.stringify({
            action: 'audio',
            audio: base64,
          })
        );
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);
      this.isCapturing = true;
    } catch (err) {
      console.error('[VoiceSession] Audio capture error:', err);
      this.emit({ type: 'error', error: 'Failed to access microphone' });
    }
  }

  /**
   * Stop capturing microphone audio.
   */
  stopCapture(): void {
    this.isCapturing = false;

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }
  }

  /**
   * Send a text message to the Sonic session.
   */
  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.emit({ type: 'error', error: 'Not connected' });
      return;
    }

    this.ws.send(
      JSON.stringify({
        action: 'text',
        text,
      })
    );
  }

  /**
   * Send a tool result back to the Sonic session.
   */
  sendToolResult(toolUseId: string, result: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        action: 'toolResult',
        toolUseId,
        toolResult: result,
      })
    );
  }

  /**
   * Disconnect and clean up.
   */
  async disconnect(): Promise<void> {
    this.maxReconnectAttempts = 0; // Prevent reconnection
    this.stopCapture();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'endSession' }));
      this.ws.close();
    }

    this.ws = null;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get capturing(): boolean {
    return this.isCapturing;
  }

  // ─── Audio Playback ──────────────────────────────────────────────────

  private async playAudio(pcmData: ArrayBuffer): Promise<void> {
    try {
      const ctx = new AudioContext({ sampleRate: 16000 });
      const int16 = new Int16Array(pcmData);
      const float32 = new Float32Array(int16.length);

      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 0x7fff;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 16000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();

      source.onended = () => ctx.close().catch(console.error);
    } catch (err) {
      console.error('[VoiceSession] Audio playback error:', err);
    }
  }

  // ─── Utilities ───────────────────────────────────────────────────────

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
