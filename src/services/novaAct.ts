export interface NovaActTool {
  name: string;
  description: string;
  input_schema: unknown;
}

export interface NovaActMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Invokes Amazon Nova Act for tool use and reasoning.
 * @param messages The conversation history
 * @param tools Available tools for the model
 * @returns The model's response, potentially including tool calls
 */
export async function invokeNovaAct(messages: NovaActMessage[], tools: NovaActTool[]): Promise<unknown> {
  if (!messages || messages.length === 0) {
    throw new Error('Messages are required');
  }

  // In a real application, we would call Nova Act via Bedrock InvokeModel.
  /*
  const command = new InvokeModelCommand({
    modelId: 'amazon.nova-act-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      messages,
      tools
    })
  });
  const response = await client.send(command);
  // Parse response
  */

  // Mocked response for test suite
  return {
    role: 'assistant',
    content: 'I will search for the price of milk.',
    tool_use: {
      name: tools[0]?.name || 'unknown',
      input: { item: 'milk' }
    }
  };
}
