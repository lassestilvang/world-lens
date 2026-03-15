import {
  BedrockRuntimeClient,
  InvokeModelWithBidirectionalStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: 'us-east-1' });

const SONIC_MODEL_ID =
  process.env.SONIC_INFERENCE_PROFILE_ARN || 'amazon.nova-2-sonic-v1:0';

export interface SonicToolDefinition {
  toolName: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface SonicSessionConfig {
  systemPrompt: string;
  tools?: SonicToolDefinition[];
  voiceId?: string;
}

/**
 * Creates the initial session configuration event for Nova Sonic.
 */
function createSessionEvent(config: SonicSessionConfig): object {
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

/**
 * Creates an audio input event from raw PCM bytes.
 */
function createAudioEvent(audioChunk: Uint8Array): object {
  return {
    event: {
      audioInput: {
        audio: Buffer.from(audioChunk).toString('base64'),
      },
    },
  };
}

/**
 * Creates a text input event for text-based interaction.
 */
function createTextEvent(text: string): object {
  return {
    event: {
      textInput: {
        content: text,
      },
    },
  };
}

/**
 * Creates a tool result event to return results back to Sonic.
 */
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

/**
 * Creates the session end event.
 */
function createEndSessionEvent(): object {
  return {
    event: {
      sessionEnd: {},
    },
  };
}

export interface SonicResponseEvent {
  type: 'audio' | 'text' | 'toolUse' | 'turnComplete' | 'error' | 'contentStart' | 'contentEnd';
  data?: unknown;
  audioChunk?: Uint8Array;
  text?: string;
  toolName?: string;
  toolUseId?: string;
  toolInput?: Record<string, unknown>;
  error?: string;
}

/**
 * Manages a single bidirectional streaming session with Nova Sonic.
 *
 * Usage:
 *   const session = new SonicSession(config);
 *   session.onEvent(callback);
 *   await session.start();
 *   session.sendAudio(audioChunk);
 *   session.sendText(text);
 *   session.sendToolResult(toolUseId, result);
 *   await session.end();
 */
export class SonicSession {
  private config: SonicSessionConfig;
  private eventCallbacks: Array<(event: SonicResponseEvent) => void> = [];
  private inputQueue: Array<object> = [];
  private isActive = false;
  private resolveInput: (() => void) | null = null;

  constructor(config: SonicSessionConfig) {
    this.config = config;
  }

  /**
   * Register a callback for response events.
   */
  onEvent(callback: (event: SonicResponseEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  private emit(event: SonicResponseEvent): void {
    for (const cb of this.eventCallbacks) {
      cb(event);
    }
  }

  /**
   * Queue an audio chunk to send to Sonic.
   */
  sendAudio(audioChunk: Uint8Array): void {
    if (!this.isActive) return;
    this.inputQueue.push(createAudioEvent(audioChunk));
    this.resolveInput?.();
  }

  /**
   * Queue a text message to send to Sonic.
   */
  sendText(text: string): void {
    if (!this.isActive) return;
    this.inputQueue.push(createTextEvent(text));
    this.resolveInput?.();
  }

  /**
   * Queue a tool result to send back to Sonic.
   */
  sendToolResult(toolUseId: string, result: string): void {
    if (!this.isActive) return;
    this.inputQueue.push(createToolResultEvent(toolUseId, result));
    this.resolveInput?.();
  }

  /**
   * End the session.
   */
  async end(): Promise<void> {
    this.isActive = false;
    this.inputQueue.push(createEndSessionEvent());
    this.resolveInput?.();
  }

  /**
   * AsyncIterable input stream for the bidirectional API.
   * Yields events from the queue, waiting when empty.
   */
  private async *inputStream(): AsyncIterable<object> {
    // First event: session configuration
    yield createSessionEvent(this.config);

    // Subsequent events: audio/text/toolResult from the queue
    while (this.isActive || this.inputQueue.length > 0) {
      if (this.inputQueue.length > 0) {
        yield this.inputQueue.shift()!;
      } else {
        // Wait for new items to be queued
        await new Promise<void>((resolve) => {
          this.resolveInput = resolve;
        });
        this.resolveInput = null;
      }
    }
  }

  /**
   * Start the bidirectional streaming session.
   * This runs until the session ends.
   */
  async start(): Promise<void> {
    this.isActive = true;

    const command = new InvokeModelWithBidirectionalStreamCommand({
      modelId: SONIC_MODEL_ID,
      body: this.inputStream() as AsyncIterable<unknown>,
    });

    try {
      const response = await client.send(command);

      if (response.body) {
        for await (const event of response.body as AsyncIterable<Record<string, unknown>>) {
          this.processOutputEvent(event);
        }
      }
    } catch (error) {
      console.error('[SonicSession] Stream error:', error);
      this.emit({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown streaming error',
      });
    } finally {
      this.isActive = false;
    }
  }

  /**
   * Processes a single output event from the Sonic stream.
   */
  private processOutputEvent(event: Record<string, unknown>): void {
    try {
      // Audio output
      if (event.audioOutput) {
        const audioData = event.audioOutput as { audio?: string };
        if (audioData.audio) {
          this.emit({
            type: 'audio',
            audioChunk: Buffer.from(audioData.audio, 'base64'),
          });
        }
        return;
      }

      // Text output (transcription or response text)
      if (event.textOutput) {
        const textData = event.textOutput as { content?: string };
        if (textData.content) {
          this.emit({
            type: 'text',
            text: textData.content,
          });
        }
        return;
      }

      // Tool use request
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

      // Content lifecycle events
      if (event.contentStart) {
        this.emit({ type: 'contentStart', data: event.contentStart });
        return;
      }

      if (event.contentEnd) {
        this.emit({ type: 'contentEnd', data: event.contentEnd });
        return;
      }

      // Turn complete
      if (event.turnComplete || event.completionReason) {
        this.emit({ type: 'turnComplete', data: event });
        return;
      }
    } catch (err) {
      console.error('[SonicSession] Error processing output event:', err);
    }
  }
}
