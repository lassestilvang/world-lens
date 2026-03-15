import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.SESSIONS_TABLE || 'WorldLensSessions';

interface MemoryData {
  environment?: string;
  objects_seen?: string[];
  user_goal?: string;
  recent_observations?: string[];
}

/**
 * GET /api/memory?sessionId=xxx
 * Retrieves session memory from DynamoDB.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  try {
    const result = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { sessionId },
      })
    );

    if (!result.Item) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data: result.Item.data });
  } catch (error) {
    console.error('[/api/memory] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session memory' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/memory
 * Saves session memory to DynamoDB.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, data } = body as { sessionId: string; data: MemoryData };

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Calculate TTL — expire after 24 hours
    const ttl = Math.floor(Date.now() / 1000) + 86400;

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          sessionId,
          data,
          updatedAt: new Date().toISOString(),
          ttl,
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[/api/memory] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save session memory' },
      { status: 500 }
    );
  }
}
