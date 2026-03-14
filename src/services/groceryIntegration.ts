import { invokeNovaAct } from './novaAct';
import { searchGroceryPrice } from './searchTools';

export async function verifyGroceryWithNovaAct(query: string) {
  const tools = [
    {
      name: 'search_grocery_price',
      description: 'Search for the current price of a grocery item from an external database',
      input_schema: { type: 'object', properties: { item: { type: 'string' } } }
    }
  ];

  const response: any = await invokeNovaAct([
    { role: 'user', content: query }
  ], tools);

  if (response.tool_use && response.tool_use.name === 'search_grocery_price') {
    const item = response.tool_use.input.item;
    // Call the mock external API via searchTools or similar
    const result = await searchGroceryPrice(item);
    return {
      item: result.item,
      price: result.price,
      source: result.source
    };
  }

  return null;
}
