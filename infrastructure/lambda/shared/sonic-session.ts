import {
  BedrockRuntimeClient,
  InvokeModelWithBidirectionalStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: 'us-east-1' });

const SONIC_MODEL_ID =
  process.env.SONIC_MODEL_ID || 'amazon.nova-2-sonic-v1:0';

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
 * Creates the session start event for Nova Sonic.
 */
function createSessionStartEvent(): object {
  return {
    event: {
      sessionStart: {
        inferenceConfiguration: {
          maxTokens: 1024,
          topP: 0.9,
          temperature: 0.7,
        },
        turnDetectionConfiguration: {
          endpointingSensitivity: 'MEDIUM',
        },
      },
    },
  };
}

/**
 * Creates the prompt start event for Nova Sonic.
 */
function createPromptStartEvent(config: {
  promptName: string;
  tools?: SonicToolDefinition[];
  voiceId?: string;
}): object {
  return {
    event: {
      promptStart: {
        promptName: config.promptName,
        textOutputConfiguration: {
          mediaType: 'text/plain',
        },
        audioOutputConfiguration: {
          mediaType: 'audio/lpcm',
          sampleRateHertz: 16000,
          sampleSizeBits: 16,
          channelCount: 1,
          voiceId: config.voiceId || 'tiffany',
          encoding: 'base64',
          audioType: 'SPEECH',
        },
        toolUseOutputConfiguration: {
          mediaType: 'application/json',
        },
        toolConfiguration: config.tools
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

function createContentStartEvent(config: {
  promptName: string;
  contentName: string;
  type: 'TEXT' | 'AUDIO' | 'TOOL';
  interactive: boolean;
  role: 'SYSTEM' | 'USER' | 'ASSISTANT' | 'TOOL' | 'SYSTEM_SPEECH';
  toolUseId?: string;
}): object {
  if (config.type === 'AUDIO') {
    return {
      event: {
        contentStart: {
          promptName: config.promptName,
          contentName: config.contentName,
          type: 'AUDIO',
          interactive: true,
          role: 'USER',
          audioInputConfiguration: {
            mediaType: 'audio/lpcm',
            sampleRateHertz: 16000,
            sampleSizeBits: 16,
            channelCount: 1,
            audioType: 'SPEECH',
            encoding: 'base64',
          },
        },
      },
    };
  }

  if (config.type === 'TOOL') {
    return {
      event: {
        contentStart: {
          promptName: config.promptName,
          contentName: config.contentName,
          type: 'TOOL',
          interactive: false,
          role: 'TOOL',
          toolResultInputConfiguration: {
            toolUseId: config.toolUseId,
            type: 'TEXT',
            textInputConfiguration: {
              mediaType: 'text/plain',
            },
          },
        },
      },
    };
  }

  return {
    event: {
      contentStart: {
        promptName: config.promptName,
        contentName: config.contentName,
        type: 'TEXT',
        interactive: config.interactive,
        role: config.role,
        textInputConfiguration: {
          mediaType: 'text/plain',
        },
      },
    },
  };
}

/**
 * Creates an audio input event from raw PCM bytes.
 */
function createAudioEvent(config: {
  promptName: string;
  contentName: string;
  audioChunk: Uint8Array;
}): object {
  return {
    event: {
      audioInput: {
        promptName: config.promptName,
        contentName: config.contentName,
        content: Buffer.from(config.audioChunk).toString('base64'),
      },
    },
  };
}

/**
 * Creates a text input event for text-based interaction.
 */
function createTextEvent(config: { promptName: string; contentName: string; text: string }): object {
  return {
    event: {
      textInput: {
        promptName: config.promptName,
        contentName: config.contentName,
        content: config.text,
      },
    },
  };
}

/**
 * Creates a tool result event to return results back to Sonic.
 */
function createToolResultEvent(config: {
  promptName: string;
  contentName: string;
  result: string | Record<string, unknown>;
}): object {
  const contentStr = typeof config.result === 'string'
    ? JSON.stringify({ result: config.result })
    : JSON.stringify(config.result);

  return {
    event: {
      toolResult: {
        promptName: config.promptName,
        contentName: config.contentName,
        content: contentStr,
        status: 'success',
      },
    },
  };
}

function createContentEndEvent(config: { promptName: string; contentName: string }): object {
  return {
    event: {
      contentEnd: {
        promptName: config.promptName,
        contentName: config.contentName,
      },
    },
  };
}

function createPromptEndEvent(promptName: string): object {
  return {
    event: {
      promptEnd: {
        promptName,
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
  private promptName = `prompt-${Date.now()}`;
  private audioContentName: string | null = null;

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
    if (!this.audioContentName) {
      this.audioContentName = `audio-${Date.now()}`;
      this.inputQueue.push(
        createContentStartEvent({
          promptName: this.promptName,
          contentName: this.audioContentName,
          type: 'AUDIO',
          interactive: true,
          role: 'USER',
        })
      );
    }
    this.inputQueue.push(
      createAudioEvent({
        promptName: this.promptName,
        contentName: this.audioContentName,
        audioChunk,
      })
    );
    this.resolveInput?.();
  }

  /**
   * Queue a text message to send to Sonic.
   */
  sendText(text: string): void {
    if (!this.isActive) return;
    const contentName = `text-${Date.now()}`;
    this.inputQueue.push(
      createContentStartEvent({
        promptName: this.promptName,
        contentName,
        type: 'TEXT',
        interactive: true,
        role: 'USER',
      })
    );
    this.inputQueue.push(
      createTextEvent({
        promptName: this.promptName,
        contentName,
        text,
      })
    );
    this.inputQueue.push(
      createContentEndEvent({
        promptName: this.promptName,
        contentName,
      })
    );
    this.resolveInput?.();
  }

  /**
   * Queue a tool result to send back to Sonic.
   */
  sendToolResult(toolUseId: string, result: string | Record<string, unknown>): void {
    if (!this.isActive) return;
    const contentName = `tool-${Date.now()}`;
    this.inputQueue.push(
      createContentStartEvent({
        promptName: this.promptName,
        contentName,
        type: 'TOOL',
        interactive: false,
        role: 'TOOL',
        toolUseId,
      })
    );
    this.inputQueue.push(
      createToolResultEvent({
        promptName: this.promptName,
        contentName,
        result,
      })
    );
    this.inputQueue.push(
      createContentEndEvent({
        promptName: this.promptName,
        contentName,
      })
    );
    this.resolveInput?.();
  }

  /**
   * End the session.
   */
  async end(): Promise<void> {
    this.isActive = false;
    if (this.audioContentName) {
      this.inputQueue.push(
        createContentEndEvent({
          promptName: this.promptName,
          contentName: this.audioContentName,
        })
      );
      this.audioContentName = null;
    }
    this.inputQueue.push(createPromptEndEvent(this.promptName));
    this.inputQueue.push(createEndSessionEvent());
    this.resolveInput?.();
  }

  /**
   * AsyncIterable input stream for the bidirectional API.
   * Yields events from the queue, waiting when empty.
   */
  private async *inputStream(): AsyncIterable<object> {
    const systemContentName = `system-${Date.now()}`;

    // First event: session start + prompt start + system prompt
    yield createSessionStartEvent();
    yield createPromptStartEvent({
      promptName: this.promptName,
      tools: this.config.tools,
      voiceId: this.config.voiceId,
    });
    yield createContentStartEvent({
      promptName: this.promptName,
      contentName: systemContentName,
      type: 'TEXT',
      interactive: false,
      role: 'SYSTEM',
    });
    yield createTextEvent({
      promptName: this.promptName,
      contentName: systemContentName,
      text: this.config.systemPrompt,
    });
    yield createContentEndEvent({
      promptName: this.promptName,
      contentName: systemContentName,
    });

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
        const audioData = event.audioOutput as { content?: string };
        if (audioData.content) {
          this.emit({
            type: 'audio',
            audioChunk: Buffer.from(audioData.content, 'base64'),
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
