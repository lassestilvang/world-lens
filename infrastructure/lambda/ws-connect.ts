import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;

interface WebSocketConnectEvent {
  requestContext: {
    connectionId: string;
    routeKey: string;
    eventType: string;
    domainName: string;
    stage: string;
  };
  queryStringParameters?: {
    sessionId?: string;
  };
}

export async function handler(event: WebSocketConnectEvent): Promise<APIGatewayProxyResultV2> {
  const connectionId = event.requestContext.connectionId;
  const sessionId = event.queryStringParameters?.sessionId || 'default';

  console.log(`[ws-connect] connectionId=${connectionId} sessionId=${sessionId}`);

  try {
    await ddb.send(
      new PutCommand({
        TableName: CONNECTIONS_TABLE,
        Item: {
          connectionId,
          sessionId,
          connectedAt: new Date().toISOString(),
        },
      })
    );

    return { statusCode: 200, body: 'Connected' };
  } catch (error) {
    console.error('[ws-connect] Error:', error);
    return { statusCode: 500, body: 'Failed to connect' };
  }
}
