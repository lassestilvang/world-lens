'use client';

/**
 * VoiceSession — manages direct streaming to Nova Sonic via Bedrock Runtime.
 *
 * Handles:
 * - Bedrock bidirectional streaming session
 * - Audio capture from microphone (PCM 16-bit, 16kHz mono)
 * - Sending audio chunks to Bedrock
 * - Receiving and playing audio response chunks
 * - Tool call events and transcript events
 */

import {
  BedrockRuntimeClient,
  InvokeModelWithBidirectionalStreamCommand,
  type InvokeModelWithBidirectionalStreamInput,
  type InvokeModelWithBidirectionalStreamOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';

const SONIC_MODEL_ID =
  process.env.NEXT_PUBLIC_SONIC_MODEL_ID || 'amazon.nova-2-sonic-v1:0';

export interface VoiceSessionConfig {
  sessionId: string;
  memoryContext?: string;
  bedrockRegion?: string;
  identityRegion?: string;
  identityPoolId?: string;
  voiceId?: string;
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

function buildSystemPrompt(memoryContext?: string): string {
  const base = `You are WorldLens, an AI assistant that helps users understand the world around them through their camera and voice. You are friendly, concise, and proactive.

CRITICAL RULES:
1. If you cannot clearly see or read something, say so honestly.
2. For medical/legal/financial content, always include a safety disclaimer.
3. Be concise — the user is having a real-time conversation, not reading an essay.
4. When a new object is relevant to the user's stated goal, proactively mention it.`;

  if (memoryContext) {
    return `${base}\n\nCurrent World Memory:\n${memoryContext}`;
  }
  return base;
}

function getSonicTools() {
  return [
    {
      toolName: 'analyze_frame',
      description:
        'Analyze the current camera frame to identify objects, text, and environment type. Call this when the user asks about what they see or when you need visual context.',
      inputSchema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'What to look for in the frame',
          },
        },
      },
    },
    {
      toolName: 'update_memory',
      description:
        'Update the world memory with new observations. Call this when new important objects or context are detected.',
      inputSchema: {
        type: 'object',
        properties: {
          observations: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of new observations to add to memory',
          },
          userGoal: {
            type: 'string',
            description: 'Updated user goal if detected from conversation',
          },
        },
      },
    },
  ];
}

function createSessionEvent(config: {
  systemPrompt: string;
  tools?: ReturnType<typeof getSonicTools>;
  voiceId?: string;
}): object {
  return {
    event: {
      sessionConfiguration: {
        instructionEvent: {
          content: config.systemPrompt,
        },
        audioOutputConfiguration: {
          voiceId: config.voiceId || 'tiffany',
          mediaType: 'audio/lpcm',
          sampleRateHertz: 16000,
          sampleSizeBits: 16,
          channelCount: 1,
        },
        audioInputConfiguration: {
          mediaType: 'audio/lpcm',
          sampleRateHertz: 16000,
          sampleSizeBits: 16,
          channelCount: 1,
        },
        toolUseConfiguration: config.tools
          ? {
              tools: config.tools.map((t) => ({
                toolSpec: {
                  name: t.toolName,
                  description: t.description,
                  inputSchema: { json: JSON.stringify(t.inputSchema) },
                },
              })),
            }
          : undefined,
      },
    },
  };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function createAudioEvent(audioChunk: Uint8Array): object {
  return {
    event: {
      audioInput: {
        audio: uint8ToBase64(audioChunk),
      },
    },
  };
}

function createTextEvent(text: string): object {
  return {
    event: {
      textInput: {
        content: text,
      },
    },
  };
}

function createToolResultEvent(toolUseId: string, result: string): object {
  return {
    event: {
      toolResult: {
        toolUseId,
        content: result,
        status: 'success',
      },
    },
  };
}

function createEndSessionEvent(): object {
  return {
    event: {
      sessionEnd: {},
    },
  };
}

export class VoiceSession {
  private config: VoiceSessionConfig;
  private callbacks: VoiceEventCallback[] = [];
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | ScriptProcessorNode | null = null;
  private isCapturing = false;

  private client: BedrockRuntimeClient | null = null;
  private inputQueue: Array<InvokeModelWithBidirectionalStreamInput> = [];
  private resolveInput: (() => void) | null = null;
  private isActive = false;
  private streamTask: Promise<void> | null = null;
  private sessionStarted = false;

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
   * Initialize the Bedrock runtime client and start the session stream.
   */
  async connect(): Promise<void> {
    if (this.isActive) return;

    const identityPoolId =
      this.config.identityPoolId || process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID;
    if (!identityPoolId) {
      throw new Error('Missing Cognito Identity Pool ID (NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID)');
    }

    const bedrockRegion =
      this.config.bedrockRegion ||
      process.env.NEXT_PUBLIC_BEDROCK_REGION ||
      process.env.NEXT_PUBLIC_AWS_REGION ||
      'us-east-1';
    if (!bedrockRegion) {
      throw new Error('Missing Bedrock region (NEXT_PUBLIC_BEDROCK_REGION or NEXT_PUBLIC_AWS_REGION)');
    }

    const identityRegionFromPool = identityPoolId.includes(':')
      ? identityPoolId.split(':')[0]
      : undefined;
    const identityRegion =
      this.config.identityRegion ||
      identityRegionFromPool ||
      process.env.NEXT_PUBLIC_AWS_REGION ||
      bedrockRegion;
    if (!identityRegion) {
      throw new Error('Missing Cognito identity region');
    }

    if (process.env.NODE_ENV !== 'production') {
      console.info('[VoiceSession] Regions', {
        bedrockRegion,
        identityRegion,
        identityPoolId,
      });
    }

    const credentialsProvider = fromCognitoIdentityPool({
      clientConfig: { region: identityRegion },
      identityPoolId,
    });
    const credentials = await credentialsProvider();

    if (process.env.NODE_ENV !== 'production') {
      console.info('[VoiceSession] Credentials', {
        accessKeyId: credentials.accessKeyId?.slice(-4),
        hasSessionToken: Boolean(credentials.sessionToken),
        expiration: credentials.expiration instanceof Date
          ? credentials.expiration.toISOString()
          : credentials.expiration,
      });
    }

    this.client = new BedrockRuntimeClient({
      region: bedrockRegion,
      credentials: credentialsProvider,
    });

    if (process.env.NODE_ENV !== 'production') {
      this.client.middlewareStack.add(
        (next) => async (args) => {
          const request = args.request as {
            hostname?: string;
            protocol?: string;
            path?: string;
            query?: Record<string, string>;
          };
          if (request?.hostname && request?.query) {
            console.info('[VoiceSession] Bedrock request', {
              host: request.hostname,
              protocol: request.protocol,
              path: request.path,
              hasSecurityToken: Boolean(request.query['X-Amz-Security-Token']),
              hasSignature: Boolean(request.query['X-Amz-Signature']),
              amzDate: request.query['X-Amz-Date'],
            });
          }
          return next(args);
        },
        { step: 'finalizeRequest', name: 'logBedrockRequest' }
      );
    }

    this.isActive = true;
    this.emit({ type: 'connected' });

    this.streamTask = this.startStream();
  }

  /**
   * Start the Bedrock bidirectional stream and process output events.
   */
  private async startStream(): Promise<void> {
    if (!this.client) return;

    const command = new InvokeModelWithBidirectionalStreamCommand({
      modelId: SONIC_MODEL_ID,
      body: this.inputStream(),
    });

    try {
      const response = await this.client.send(command);
      this.sessionStarted = true;
      this.emit({ type: 'sessionStarted' });

      if (response.body) {
        for await (const event of response.body as AsyncIterable<InvokeModelWithBidirectionalStreamOutput>) {
          if ('chunk' in event && event.chunk?.bytes) {
            const payloadText = new TextDecoder().decode(event.chunk.bytes);
            const payload = JSON.parse(payloadText) as Record<string, unknown>;
            this.processOutputEvent(payload);
            continue;
          }

          if ('internalServerException' in event && event.internalServerException?.message) {
            throw new Error(event.internalServerException.message);
          }
          if ('modelStreamErrorException' in event && event.modelStreamErrorException?.message) {
            throw new Error(event.modelStreamErrorException.message);
          }
          if ('modelTimeoutException' in event && event.modelTimeoutException?.message) {
            throw new Error(event.modelTimeoutException.message);
          }
          if ('serviceUnavailableException' in event && event.serviceUnavailableException?.message) {
            throw new Error(event.serviceUnavailableException.message);
          }
          if ('throttlingException' in event && event.throttlingException?.message) {
            throw new Error(event.throttlingException.message);
          }
          if ('validationException' in event && event.validationException?.message) {
            throw new Error(event.validationException.message);
          }
        }
      }
    } catch (error) {
      console.error('[VoiceSession] Stream error:', error);
      if (error && typeof error === 'object' && '$response' in error) {
        // @ts-expect-error debug logging
        console.error('[VoiceSession] Response', error.$response);
      }
      this.emit({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown streaming error',
      });
    } finally {
      this.isActive = false;
      this.sessionStarted = false;
      this.emit({ type: 'disconnected' });
    }
  }

  /**
   * AsyncIterable input stream for the bidirectional API.
   */
  private async *inputStream(): AsyncIterable<InvokeModelWithBidirectionalStreamInput> {
    yield this.encodeInput(
      createSessionEvent({
        systemPrompt: buildSystemPrompt(this.config.memoryContext),
        tools: getSonicTools(),
        voiceId: this.config.voiceId,
      })
    );

    while (this.isActive || this.inputQueue.length > 0) {
      if (this.inputQueue.length > 0) {
        yield this.inputQueue.shift()!;
      } else {
        await new Promise<void>((resolve) => {
          this.resolveInput = resolve;
        });
        this.resolveInput = null;
      }
    }
  }

  /**
   * Handle incoming events from the Bedrock stream.
   */
  private processOutputEvent(event: Record<string, unknown>): void {
    try {
      if (event.audioOutput) {
        const audioData = event.audioOutput as { audio?: string };
        if (audioData.audio) {
          const audioBytes = base64ToUint8(audioData.audio);
          const audioBuffer = new ArrayBuffer(audioBytes.byteLength);
          new Uint8Array(audioBuffer).set(audioBytes);
          this.playAudio(audioBuffer);
          this.emit({ type: 'audio', audio: audioBuffer });
        }
        return;
      }

      if (event.textOutput) {
        const textData = event.textOutput as { content?: string };
        if (textData.content) {
          this.emit({ type: 'text', text: textData.content });
        }
        return;
      }

      if (event.toolUse) {
        const toolData = event.toolUse as {
          toolUseId?: string;
          name?: string;
          input?: string;
        };
        this.emit({
          type: 'toolUse',
          toolUseId: toolData.toolUseId,
          toolName: toolData.name,
          toolInput: toolData.input ? JSON.parse(toolData.input) : {},
        });
        return;
      }

      if (event.turnComplete || event.completionReason) {
        this.emit({ type: 'turnComplete' });
        return;
      }
    } catch (err) {
      console.error('[VoiceSession] Error processing output event:', err);
    }
  }

  /**
   * Start capturing microphone audio and streaming to Bedrock.
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
        if (!this.isCapturing) return;

        const inputData = event.inputBuffer.getChannelData(0);

        // Convert Float32 [-1, 1] to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        this.sendAudio(pcmData);
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
   * Send audio bytes to the Sonic session.
   */
  private sendAudio(pcmData: Int16Array): void {
    if (!this.isActive) return;
    this.inputQueue.push(this.encodeInput(createAudioEvent(new Uint8Array(pcmData.buffer))));
    this.resolveInput?.();
  }

  /**
   * Send a text message to the Sonic session.
   */
  sendText(text: string): void {
    if (!this.isActive) {
      this.emit({ type: 'error', error: 'Not connected' });
      return;
    }

    this.inputQueue.push(this.encodeInput(createTextEvent(text)));
    this.resolveInput?.();
  }

  /**
   * Send a tool result back to the Sonic session.
   */
  sendToolResult(toolUseId: string, result: string): void {
    if (!this.isActive) return;
    this.inputQueue.push(this.encodeInput(createToolResultEvent(toolUseId, result)));
    this.resolveInput?.();
  }

  /**
   * Disconnect and clean up.
   */
  async disconnect(): Promise<void> {
    this.stopCapture();
    if (this.isActive) {
      this.inputQueue.push(this.encodeInput(createEndSessionEvent()));
      this.resolveInput?.();
    }

    this.isActive = false;
    this.sessionStarted = false;

    if (this.streamTask) {
      await this.streamTask.catch(() => undefined);
      this.streamTask = null;
    }

    this.client?.destroy?.();
    this.client = null;

    this.emit({ type: 'sessionEnded' });
  }

  get connected(): boolean {
    return this.isActive;
  }

  get capturing(): boolean {
    return this.isCapturing;
  }

  private encodeInput(event: object): InvokeModelWithBidirectionalStreamInput {
    const json = JSON.stringify(event);
    const bytes = new TextEncoder().encode(json);
    return { chunk: { bytes } };
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
}
