'use client';

/**
 * VoiceSession - manages direct streaming to Nova Sonic via Bedrock Runtime.
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
import {
  CognitoIdentityClient,
  GetIdCommand,
  GetOpenIdTokenCommand,
} from '@aws-sdk/client-cognito-identity';
import {
  AssumeRoleWithWebIdentityCommand,
  STSClient,
} from '@aws-sdk/client-sts';

const SONIC_MODEL_ID =
  process.env.NEXT_PUBLIC_SONIC_MODEL_ID || 'amazon.nova-2-sonic-v1:0';

export interface VoiceSessionConfig {
  sessionId: string;
  memoryContext?: string;
  bedrockRegion?: string;
  identityRegion?: string;
  identityPoolId?: string;
  voiceId?: string;
  userGoal?: string;
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

function buildSystemPrompt(memoryContext?: string, userGoal?: string): string {
  const base = `You are WorldLens, an AI assistant that helps users understand the world around them through their camera and voice. You are friendly, conversational, and proactive.

CRITICAL RULES:
1. YOU HAVE EYES! Use the "analyze_frame" tool whenever the user asks "what do you see?", "where is X?", or for any visual context. Do NOT ask the user to describe the scene; use the tool instead.
2. BE PROACTIVE: If you see something relevant to the user's goal or a significant change in the scene, mention it naturally. 
3. GREET THE USER: When you first connect, greet the user warmly and ask how you can help based on their current goal.
4. SYSTEM OBSERVATIONS: You may receive messages starting with "[System Observation]". These are direct updates from the computer vision loop. Treat them as your own observations and respond to them proactively if they are important.
5. If you cannot clearly see or read something AFTER using the tool, say so honestly.
6. For medical/legal/financial content, always include a safety disclaimer.
7. Be concise and conversational - the user is having a real-time conversation, not reading an essay.
8. If the user hasn't set a goal, ask them what they are looking for today.`;

  let prompt = base;
  if (userGoal) {
    prompt += `\n\nCURRENT USER GOAL: ${userGoal}`;
  } else {
    prompt += '\n\nThe user has NOT yet set a goal. Ask them what they are looking for and use the "update_memory" tool to set their goal once you know it.';
  }
  prompt += '\n\nIMPORTANT: If the user changes their task or goal vocally, you MUST use the "update_memory" tool with the "userGoal" parameter to update the system. Immediately after calling the tool, YOU MUST vocally acknowledge the change to the user and explain how you will help. Do NOT remain silent after a goal update.';
  if (memoryContext) {
    prompt += `\n\nCurrent World Memory:\n${memoryContext}`;
  }
  return prompt;
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiration?: Date;
};

function createClassicCognitoCredentialProvider(config: {
  identityPoolId: string;
  identityRegion: string;
  unauthRoleArn: string;
}): () => Promise<AwsCredentials> {
  let cached: AwsCredentials | null = null;
  let refreshing: Promise<AwsCredentials> | null = null;

  const isExpired = (expiration?: Date) => {
    if (!expiration) return true;
    return expiration.getTime() - Date.now() < 60_000;
  };

  return async () => {
    if (cached && !isExpired(cached.expiration)) {
      return cached;
    }
    if (refreshing) return refreshing;

    refreshing = (async () => {
      const cognito = new CognitoIdentityClient({ region: config.identityRegion });
      const sts = new STSClient({ region: config.identityRegion });

      const { IdentityId } = await cognito.send(
        new GetIdCommand({ IdentityPoolId: config.identityPoolId })
      );
      if (!IdentityId) {
        throw new Error('Failed to resolve Cognito IdentityId');
      }

      const { Token } = await cognito.send(
        new GetOpenIdTokenCommand({ IdentityId })
      );
      if (!Token) {
        throw new Error('Failed to acquire Cognito OpenId token');
      }

      const safeSessionName = `cognito-identity-${IdentityId}`.replace(/[^\\w+=,.@-]/g, '-');
      const assume = await sts.send(
        new AssumeRoleWithWebIdentityCommand({
          RoleArn: config.unauthRoleArn,
          RoleSessionName: safeSessionName,
          WebIdentityToken: Token,
        })
      );

      const creds = assume.Credentials;
      if (!creds?.AccessKeyId || !creds.SecretAccessKey) {
        throw new Error('Failed to assume role with web identity');
      }

      cached = {
        accessKeyId: creds.AccessKeyId,
        secretAccessKey: creds.SecretAccessKey,
        sessionToken: creds.SessionToken,
        expiration: creds.Expiration,
      };

      return cached;
    })();

    try {
      return await refreshing;
    } finally {
      refreshing = null;
    }
  };
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

function createPromptStartEvent(config: {
  promptName: string;
  tools?: ReturnType<typeof getSonicTools>;
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
        content: uint8ToBase64(config.audioChunk),
      },
    },
  };
}

function createTextEvent(config: {
  promptName: string;
  contentName: string;
  text: string;
}): object {
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

function createContentEndEvent(config: {
  promptName: string;
  contentName: string;
}): object {
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
  private promptName: string;
  private audioContentName: string | null = null;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private lastInputAt = 0;
  private playbackContext: AudioContext | null = null;
  private nextPlaybackTime = 0;
  private contentRoles = new Map<string, { role?: string; type?: string; completionId?: string }>();
  private suppressedAssistantContentIds = new Set<string>();
  private interruptedCompletionIds = new Set<string>();
  private lastCompletionId: string | null = null;
  private analyzer: AnalyserNode | null = null;
  private activeSources: Set<AudioBufferSourceNode> = new Set();

  constructor(config: VoiceSessionConfig) {
    this.config = config;
    this.promptName = config.sessionId || createId('prompt');
    this.lastInputAt = Date.now();
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

  private resolveContentId(eventData: { contentName?: string; contentId?: string }): string | undefined {
    return eventData.contentName || eventData.contentId;
  }

  private shouldSuppressAssistantOutput(completionId?: string, contentId?: string): boolean {
    if (completionId && this.interruptedCompletionIds.has(completionId)) {
      return true;
    }
    if (contentId && this.suppressedAssistantContentIds.has(contentId)) {
      return true;
    }
    return false;
  }

  private markActiveAssistantOutputAsInterrupted(): void {
    for (const [contentId, content] of this.contentRoles.entries()) {
      if (content.role === 'ASSISTANT') {
        this.suppressedAssistantContentIds.add(contentId);
        if (content.completionId) {
          this.interruptedCompletionIds.add(content.completionId);
        }
      }
    }

    if (this.lastCompletionId) {
      this.interruptedCompletionIds.add(this.lastCompletionId);
    }
  }

  private stopPlayback(): void {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Source might have already ended or not started.
      }
      source.disconnect();
    });
    this.activeSources.clear();

    if (this.playbackContext) {
      this.nextPlaybackTime = this.playbackContext.currentTime;
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

    const unauthRoleArn =
      process.env.NEXT_PUBLIC_COGNITO_UNAUTH_ROLE_ARN;
    if (!unauthRoleArn) {
      throw new Error('Missing Cognito unauth role ARN (NEXT_PUBLIC_COGNITO_UNAUTH_ROLE_ARN)');
    }

    if (process.env.NODE_ENV !== 'production') {
      console.info('[VoiceSession] Regions', {
        bedrockRegion,
        identityRegion,
        identityPoolId,
        unauthRoleArn,
      });
    }

    const credentialsProvider = createClassicCognitoCredentialProvider({
      identityPoolId,
      identityRegion,
      unauthRoleArn,
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
    this.startKeepalive();
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
      const response = (error as { $response?: unknown })?.$response;
      if (response) {
        console.error('[VoiceSession] Response', response);
      }
      this.emit({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown streaming error',
      });
    } finally {
      this.isActive = false;
      this.sessionStarted = false;
      this.stopKeepalive();
      this.emit({ type: 'disconnected' });
    }
  }

  /**
   * AsyncIterable input stream for the bidirectional API.
   */
  private async *inputStream(): AsyncIterable<InvokeModelWithBidirectionalStreamInput> {
    const systemPrompt = buildSystemPrompt(this.config.memoryContext, this.config.userGoal);
    const systemContentName = createId('system');

    yield this.encodeInput(createSessionStartEvent());
    this.markInputSent();
    yield this.encodeInput(
      createPromptStartEvent({
        promptName: this.promptName,
        tools: getSonicTools(),
        voiceId: this.config.voiceId,
      })
    );
    this.markInputSent();
    yield this.encodeInput(
      createContentStartEvent({
        promptName: this.promptName,
        contentName: systemContentName,
        type: 'TEXT',
        interactive: false,
        role: 'SYSTEM',
      })
    );
    this.markInputSent();
    yield this.encodeInput(
      createTextEvent({
        promptName: this.promptName,
        contentName: systemContentName,
        text: systemPrompt,
      })
    );
    this.markInputSent();
    yield this.encodeInput(
      createContentEndEvent({
        promptName: this.promptName,
        contentName: systemContentName,
      })
    );
    this.markInputSent();

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
      const payload =
        event.event && typeof event.event === 'object'
          ? (event.event as Record<string, unknown>)
          : event;

      if (payload.completionStart) {
        const completionData = payload.completionStart as { completionId?: string };
        if (completionData.completionId) {
          this.lastCompletionId = completionData.completionId;
        }
        return;
      }

      if (payload.audioOutput) {
        const audioData = payload.audioOutput as {
          content?: string;
          contentName?: string;
          contentId?: string;
          completionId?: string;
        };
        const contentId = this.resolveContentId(audioData);
        if (this.shouldSuppressAssistantOutput(audioData.completionId, contentId)) {
          return;
        }
        if (audioData.content) {
          const audioBytes = base64ToUint8(audioData.content);
          const audioBuffer = new ArrayBuffer(audioBytes.byteLength);
          new Uint8Array(audioBuffer).set(audioBytes);
          this.playAudio(audioBuffer);
          this.emit({ type: 'audio', audio: audioBuffer });
        }
        return;
      }

      if (payload.textOutput) {
        const textData = payload.textOutput as {
          content?: string;
          contentName?: string;
          contentId?: string;
          completionId?: string;
          role?: string;
        };
        const contentId = this.resolveContentId(textData);
        if (this.shouldSuppressAssistantOutput(textData.completionId, contentId)) {
          return;
        }
        if (textData.content) {
          const role =
            textData.role ||
            (contentId ? this.contentRoles.get(contentId)?.role : undefined);
          const trimmed = textData.content.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            return;
          }
          if (role === 'USER') {
            // Filter out system internal observations from the transcript
            if (trimmed.startsWith('[System Observation]')) {
              return;
            }
            this.emit({ type: 'transcript', text: textData.content });
          } else {
            this.emit({ type: 'text', text: textData.content });
          }
        }
        return;
      }

      if (payload.contentStart) {
        const contentData = payload.contentStart as {
          contentName?: string;
          contentId?: string;
          completionId?: string;
          role?: string;
          type?: string;
        };
        const contentId = this.resolveContentId(contentData);
        if (contentId) {
          this.contentRoles.set(contentId, {
            role: contentData.role,
            type: contentData.type,
            completionId: contentData.completionId,
          });
        }
        return;
      }

      if (payload.contentEnd) {
        const contentData = payload.contentEnd as {
          contentName?: string;
          contentId?: string;
          completionId?: string;
          stopReason?: string;
        };
        const contentId = this.resolveContentId(contentData);
        if (contentId) {
          this.contentRoles.delete(contentId);
          this.suppressedAssistantContentIds.delete(contentId);
        }

        if (contentData.completionId && contentData.stopReason === 'INTERRUPTED') {
          this.interruptedCompletionIds.delete(contentData.completionId);
        }
        return;
      }

      if (payload.toolUse) {
        const toolData = payload.toolUse as {
          toolUseId?: string;
          name?: string;
          toolName?: string;
          input?: string | Record<string, unknown>;
          content?: string | Record<string, unknown>;
        };
        const name = toolData.name || toolData.toolName;
        console.info('[VoiceSession] Tool Use received:', name, toolData.toolUseId, toolData);
        
        let parsedInput = {};
        const rawInput = toolData.input ?? toolData.content;
        if (typeof rawInput === 'string') {
          try {
            parsedInput = JSON.parse(rawInput);
          } catch {
            parsedInput = { raw: rawInput };
          }
        } else if (typeof rawInput === 'object' && rawInput !== null) {
          parsedInput = rawInput;
        }

        this.emit({
          type: 'toolUse',
          toolUseId: toolData.toolUseId,
          toolName: name || 'unknown',
          toolInput: parsedInput as Record<string, unknown>,
        });
        return;
      }

      if (payload.completionEnd) {
        const completionData = payload.completionEnd as {
          completionId?: string;
          stopReason?: string;
        };

        if (completionData.completionId) {
          this.interruptedCompletionIds.delete(completionData.completionId);
          if (this.lastCompletionId === completionData.completionId) {
            this.lastCompletionId = null;
          }
        }

        if (completionData.stopReason === 'INTERRUPTED') {
          this.stopPlayback();
        }

        this.emit({ type: 'turnComplete' });
        return;
      }

      if (payload.turnComplete || payload.completionReason) {
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
      
      // Create and connect analyzer for VAD
      const analyzer = this.audioContext.createAnalyser();
      analyzer.fftSize = 512;
      source.connect(analyzer);
      this.analyzer = analyzer;

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

    if (this.analyzer) {
      this.analyzer.disconnect();
      this.analyzer = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }

    if (this.isActive && this.audioContentName) {
      this.inputQueue.push(
        this.encodeInput(
          createContentEndEvent({
            promptName: this.promptName,
            contentName: this.audioContentName,
          })
        )
      );
      this.markInputSent();
      this.resolveInput?.();
      this.audioContentName = null;
    }
  }

  /**
   * Send audio bytes to the Sonic session.
   */
  private sendAudio(pcmData: Int16Array): void {
    if (!this.isActive) return;
    if (!this.audioContentName) {
      this.audioContentName = createId('audio');
      this.inputQueue.push(
        this.encodeInput(
          createContentStartEvent({
            promptName: this.promptName,
            contentName: this.audioContentName,
            type: 'AUDIO',
            interactive: true,
            role: 'USER',
          })
        )
      );
      this.markInputSent();
    }

    this.inputQueue.push(
      this.encodeInput(
        createAudioEvent({
          promptName: this.promptName,
          contentName: this.audioContentName,
          audioChunk: new Uint8Array(pcmData.buffer),
        })
      )
    );
    this.markInputSent();
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

    const contentName = createId('text');
    console.info(`[VoiceSession] Sending text: "${text}"`);
    this.inputQueue.push(
      this.encodeInput(
        createContentStartEvent({
          promptName: this.promptName,
          contentName,
          type: 'TEXT',
          interactive: true,
          role: 'USER',
        })
      )
    );
    this.markInputSent();
    this.inputQueue.push(
      this.encodeInput(
        createTextEvent({
          promptName: this.promptName,
          contentName,
          text,
        })
      )
    );
    this.markInputSent();
    this.inputQueue.push(
      this.encodeInput(
        createContentEndEvent({
          promptName: this.promptName,
          contentName,
        })
      )
    );
    this.markInputSent();
    this.resolveInput?.();
  }

  /**
   * Send a tool result back to the Sonic session.
   */
  sendToolResult(toolUseId: string, result: string | Record<string, unknown>): void {
    if (!this.isActive) return;
    const contentName = createId('tool');
    this.inputQueue.push(
      this.encodeInput(
        createContentStartEvent({
          promptName: this.promptName,
          contentName,
          type: 'TOOL',
          interactive: false,
          role: 'TOOL',
          toolUseId,
        })
      )
    );
    this.markInputSent();
    this.inputQueue.push(
      this.encodeInput(
        createToolResultEvent({
          promptName: this.promptName,
          contentName,
          result,
        })
      )
    );
    this.markInputSent();
    this.inputQueue.push(
      this.encodeInput(
        createContentEndEvent({
          promptName: this.promptName,
          contentName,
        })
      )
    );
    this.markInputSent();
    this.resolveInput?.();
  }

  /**
   * Interrupt current audio playback and clear pending queues.
   */
  interrupt(): void {
    console.info('[VoiceSession] Interrupting playback...');

    this.markActiveAssistantOutputAsInterrupted();
    this.stopPlayback();
    
    this.emit({ type: 'text', text: '[Interrupted]' });
  }

  /**
   * Disconnect and clean up.
   */
  async disconnect(): Promise<void> {
    this.stopCapture();
    if (this.isActive) {
      if (this.audioContentName) {
        this.inputQueue.push(
          this.encodeInput(
            createContentEndEvent({
              promptName: this.promptName,
              contentName: this.audioContentName,
            })
          )
        );
        this.markInputSent();
        this.audioContentName = null;
      }
      this.inputQueue.push(this.encodeInput(createPromptEndEvent(this.promptName)));
      this.markInputSent();
      this.inputQueue.push(this.encodeInput(createEndSessionEvent()));
      this.markInputSent();
      this.resolveInput?.();
    }

    this.isActive = false;
    this.sessionStarted = false;
    this.contentRoles.clear();
    this.suppressedAssistantContentIds.clear();
    this.interruptedCompletionIds.clear();
    this.lastCompletionId = null;

    if (this.streamTask) {
      await this.streamTask.catch(() => undefined);
      this.streamTask = null;
    }

    this.client?.destroy?.();
    this.client = null;

    if (this.playbackContext) {
      this.playbackContext.close().catch(console.error);
      this.playbackContext = null;
      this.nextPlaybackTime = 0;
    }

    this.emit({ type: 'sessionEnded' });
  }

  get connected(): boolean {
    return this.isActive;
  }

  get capturing(): boolean {
    return this.isCapturing;
  }

  get analyzerNode(): AnalyserNode | null {
    return this.analyzer;
  }

  get isSpeaking(): boolean {
    return this.activeSources.size > 0;
  }

  private encodeInput(event: object): InvokeModelWithBidirectionalStreamInput {
    const json = JSON.stringify(event);
    const bytes = new TextEncoder().encode(json);
    return { chunk: { bytes } };
  }

  private markInputSent(): void {
    this.lastInputAt = Date.now();
  }

  private startKeepalive(): void {
    if (this.keepaliveTimer) return;
    const intervalMs = 20_000;
    this.keepaliveTimer = setInterval(() => {
      if (!this.isActive) return;
      if (Date.now() - this.lastInputAt < intervalMs) return;
      // Send a short silence frame to keep the session alive.
      const silence = new Int16Array(160);
      this.sendAudio(silence);
    }, intervalMs);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  // ─── Audio Playback ──────────────────────────────────────────────────

  private async playAudio(pcmData: ArrayBuffer): Promise<void> {
    try {
      const sourceSampleRate = 16000;
      if (!this.playbackContext) {
        this.playbackContext = new AudioContext({ sampleRate: sourceSampleRate });
        this.nextPlaybackTime = this.playbackContext.currentTime;
      }
      const ctx = this.playbackContext;
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => undefined);
      }

      const int16 = new Int16Array(pcmData);
      const float32 = new Float32Array(int16.length);

      for (let i = 0; i < int16.length; i++) {
        const sample = int16[i] / 32768;
        float32[i] = Math.max(-1, Math.min(1, sample));
      }

      const targetSampleRate = ctx.sampleRate || sourceSampleRate;
      let samples = float32;

      if (targetSampleRate !== sourceSampleRate && float32.length > 1) {
        const ratio = targetSampleRate / sourceSampleRate;
        const resampledLength = Math.max(1, Math.round(float32.length * ratio));
        const resampled = new Float32Array(resampledLength);
        for (let i = 0; i < resampledLength; i++) {
          const position = i / ratio;
          const left = Math.floor(position);
          const right = Math.min(left + 1, float32.length - 1);
          const weight = position - left;
          resampled[i] = float32[left] * (1 - weight) + float32[right] * weight;
        }
        samples = resampled;
      }

      const audioBuffer = ctx.createBuffer(1, samples.length, targetSampleRate);
      audioBuffer.getChannelData(0).set(samples);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      this.activeSources.add(source);
      
      const startTime = Math.max(ctx.currentTime, this.nextPlaybackTime);
      source.start(startTime);
      this.nextPlaybackTime = startTime + audioBuffer.duration;

      source.onended = () => {
        this.activeSources.delete(source);
        if (this.playbackContext && this.nextPlaybackTime < this.playbackContext.currentTime) {
          this.nextPlaybackTime = this.playbackContext.currentTime;
        }
      };
    } catch (err) {
      console.error('[VoiceSession] Audio playback error:', err);
    }
  }
}
