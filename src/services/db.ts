import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

// Standard DynamoDB client initialization
const client = new DynamoDBClient({ region: "us-east-1" });
const ddbDocClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "WorldLensSessions";

// Mock storage for testing without AWS credentials
const mockStore = new Map<string, any>();

export async function saveSessionMemory(sessionId: string, data: any): Promise<void> {
  // In testing environment, use mock store
  if (process.env.NODE_ENV === 'test') {
    mockStore.set(sessionId, data);
    return;
  }

  const params = {
    TableName: TABLE_NAME,
    Item: {
      sessionId,
      data,
      updatedAt: new Date().toISOString()
    }
  };

  try {
    await ddbDocClient.send(new PutCommand(params));
  } catch (error) {
    console.error("Error saving to DynamoDB:", error);
    throw error;
  }
}

export async function getSessionMemory(sessionId: string): Promise<any | null> {
  // In testing environment, use mock store
  if (process.env.NODE_ENV === 'test') {
    return mockStore.get(sessionId) || null;
  }

  const params = {
    TableName: TABLE_NAME,
    Key: {
      sessionId
    }
  };

  try {
    const response = await ddbDocClient.send(new GetCommand(params));
    return response.Item ? response.Item.data : null;
  } catch (error) {
    console.error("Error reading from DynamoDB:", error);
    throw error;
  }
}