import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;

interface WebSocketDisconnectEvent {
  requestContext: {
    connectionId: string;
    routeKey: string;
  };
}

export async function handler(event: WebSocketDisconnectEvent): Promise<APIGatewayProxyResultV2> {
  const connectionId = event.requestContext.connectionId;

  console.log(`[ws-disconnect] connectionId=${connectionId}`);

  try {
    await ddb.send(
      new DeleteCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId },
      })
    );

    return { statusCode: 200, body: 'Disconnected' };
  } catch (error) {
    console.error('[ws-disconnect] Error:', error);
    return { statusCode: 500, body: 'Failed to disconnect' };
  }
}
