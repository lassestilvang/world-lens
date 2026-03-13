/**
 * @jest-environment node
 */
import { invokeNovaAct } from './novaAct';

describe('Nova Act Service Wrapper', () => {
  it('should structure a tool-use request for Amazon Bedrock', async () => {
    const messages = [{ role: 'user', content: 'What is the price of milk?' }];
    const tools = [
      {
        name: 'search_prices',
        description: 'Search for current grocery prices',
        input_schema: { type: 'object', properties: { item: { type: 'string' } } }
      }
    ];

    const result = await invokeNovaAct(messages, tools);

    expect(result).toHaveProperty('tool_use');
    expect(result.tool_use.name).toBe('search_prices');
  });

  it('should throw error for empty messages', async () => {
    await expect(invokeNovaAct([], [])).rejects.toThrow('Messages are required');
  });
});
