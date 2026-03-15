import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

// Lazily initialized — prevents AWS SDK construction in browser context
let _ddbDocClient: DynamoDBDocumentClient | null = null;
function getDdbDocClient(): DynamoDBDocumentClient {
  if (!_ddbDocClient) {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    _ddbDocClient = DynamoDBDocumentClient.from(client);
  }
  return _ddbDocClient;
}

const TABLE_NAME = process.env.SESSIONS_TABLE || 'WorldLensSessions';

// Mock storage for testing without AWS credentials
const mockStore = new Map<string, unknown>();

/**
 * Saves session memory. In browser context, calls /api/memory.
 * In server context (or tests), uses DynamoDB directly.
 */
export async function saveSessionMemory(sessionId: string, data: unknown): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    mockStore.set(sessionId, data);
    return;
  }

  // Browser context — call API route
  if (typeof window !== 'undefined') {
    const response = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, data }),
    });
    if (!response.ok) {
      throw new Error(`Memory save failed: ${response.status}`);
    }
    return;
  }

  // Server context — use DynamoDB directly
  const params = {
    TableName: TABLE_NAME,
    Item: {
      sessionId,
      data,
      updatedAt: new Date().toISOString(),
    },
  };

  try {
    await getDdbDocClient().send(new PutCommand(params));
  } catch (error) {
    console.error('Error saving to DynamoDB:', error);
    throw error;
  }
}

/**
 * Retrieves session memory. In browser context, calls /api/memory.
 * In server context (or tests), uses DynamoDB directly.
 */
export async function getSessionMemory(sessionId: string): Promise<unknown | null> {
  if (process.env.NODE_ENV === 'test') {
    return mockStore.get(sessionId) || null;
  }

  // Browser context — call API route
  if (typeof window !== 'undefined') {
    const response = await fetch(`/api/memory?sessionId=${encodeURIComponent(sessionId)}`);
    if (!response.ok) {
      throw new Error(`Memory load failed: ${response.status}`);
    }
    const result = await response.json();
    return result.data;
  }

  // Server context — use DynamoDB directly
  const params = {
    TableName: TABLE_NAME,
    Key: { sessionId },
  };

  try {
    const response = await getDdbDocClient().send(new GetCommand(params));
    return response.Item ? response.Item.data : null;
  } catch (error) {
    console.error('Error reading from DynamoDB:', error);
    throw error;
  }
}