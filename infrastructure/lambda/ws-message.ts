import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { SonicSession, SonicSessionConfig, SonicResponseEvent } from './shared/sonic-session';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;
const CALLBACK_URL = process.env.WEBSOCKET_CALLBACK_URL!;

interface WebSocketMessageEvent {
  requestContext: {
    connectionId: string;
    routeKey: string;
    domainName: string;
    stage: string;
  };
  body?: string;
  isBase64Encoded?: boolean;
}

interface ClientMessage {
  action: 'startSession' | 'audio' | 'text' | 'toolResult' | 'endSession';
  sessionId?: string;
  audio?: string; // base64-encoded PCM audio
  text?: string;
  toolUseId?: string;
  toolResult?: string;
  memoryContext?: string;
}

// ⚠️  WARNING: Lambda functions are stateless across invocations.
// This in-memory Map works when a single Lambda instance handles all messages
// for a given connection (warm invocation), but will be lost on cold starts.
// For production, move to a long-lived compute (Fargate) or externalize session state.
// For the hackathon demo, provisioned concurrency = 1 is a pragmatic workaround.
const activeSessions = new Map<string, SonicSession>();

/**
 * Send a message back to the connected WebSocket client.
 */
async function sendToClient(connectionId: string, data: unknown): Promise<void> {
  const apigw = new ApiGatewayManagementApiClient({
    endpoint: CALLBACK_URL,
  });

  try {
    await apigw.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(data)),
      })
    );
  } catch (error) {
    console.error(`[ws-message] Failed to send to ${connectionId}:`, error);
  }
}

/**
 * Build system prompt with world memory context.
 */
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

/**
 * Defines the tools that Nova Sonic can invoke mid-conversation.
 */
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

export async function handler(event: WebSocketMessageEvent): Promise<APIGatewayProxyResultV2> {
  const connectionId = event.requestContext.connectionId;

  let message: ClientMessage;
  try {
    const body = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString()
      : event.body || '{}';
    message = JSON.parse(body);
  } catch {
    console.error('[ws-message] Invalid message body');
    return { statusCode: 400, body: 'Invalid message' };
  }

  console.log(`[ws-message] connectionId=${connectionId} action=${message.action}`);

  try {
    switch (message.action) {
      case 'startSession': {
        // Look up session memory if available
        let memoryContext: string | undefined;
        if (message.sessionId) {
          const sessionData = await ddb.send(
            new GetCommand({
              TableName: SESSIONS_TABLE,
              Key: { sessionId: message.sessionId },
            })
          );
          if (sessionData.Item?.data) {
            const data = sessionData.Item.data as { memory?: string[] };
            memoryContext = data.memory?.join(', ');
          }
        }

        const config: SonicSessionConfig = {
          systemPrompt: buildSystemPrompt(memoryContext || message.memoryContext),
          tools: getSonicTools(),
        };

        const session = new SonicSession(config);
        activeSessions.set(connectionId, session);

        // Forward all Sonic events back to the client
        session.onEvent(async (sonicEvent: SonicResponseEvent) => {
          await sendToClient(connectionId, {
            type: sonicEvent.type,
            ...(sonicEvent.audioChunk && { audio: Buffer.from(sonicEvent.audioChunk).toString('base64') }),
            ...(sonicEvent.text && { text: sonicEvent.text }),
            ...(sonicEvent.toolName && {
              toolName: sonicEvent.toolName,
              toolUseId: sonicEvent.toolUseId,
              toolInput: sonicEvent.toolInput,
            }),
            ...(sonicEvent.error && { error: sonicEvent.error }),
          });
        });

        // Start the streaming session (runs in background)
        session.start().catch((err) => {
          console.error('[ws-message] Session error:', err);
          activeSessions.delete(connectionId);
        });

        await sendToClient(connectionId, { type: 'sessionStarted' });
        break;
      }

      case 'audio': {
        const session = activeSessions.get(connectionId);
        if (!session) {
          await sendToClient(connectionId, { type: 'error', error: 'No active session' });
          break;
        }
        if (message.audio) {
          session.sendAudio(Buffer.from(message.audio, 'base64'));
        }
        break;
      }

      case 'text': {
        const session = activeSessions.get(connectionId);
        if (!session) {
          await sendToClient(connectionId, { type: 'error', error: 'No active session' });
          break;
        }
        if (message.text) {
          session.sendText(message.text);
        }
        break;
      }

      case 'toolResult': {
        const session = activeSessions.get(connectionId);
        if (!session) {
          await sendToClient(connectionId, { type: 'error', error: 'No active session' });
          break;
        }
        if (message.toolUseId && message.toolResult) {
          session.sendToolResult(message.toolUseId, message.toolResult);
        }
        break;
      }

      case 'endSession': {
        const session = activeSessions.get(connectionId);
        if (session) {
          await session.end();
          activeSessions.delete(connectionId);
        }
        await sendToClient(connectionId, { type: 'sessionEnded' });
        break;
      }

      default:
        await sendToClient(connectionId, { type: 'error', error: `Unknown action: ${message.action}` });
    }

    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    console.error('[ws-message] Handler error:', error);
    return { statusCode: 500, body: 'Internal error' };
  }
}
