/**
 * @jest-environment node
 */
import { triggerGroundingTool } from './groundingOrchestrator';
import { formatAttributedResponse } from './attributionService';

describe('End-to-End Grocery Grounding Integration', () => {
  it('should complete a full grocery grounding flow', async () => {
    const context = { scenario: 'grocery', query: 'price of milk' };
    
    // 1. Trigger grounding
    const groundedResult = await triggerGroundingTool(context);
    expect(groundedResult.verified_fact).toContain('Verified: The price of milk is $3.49');
    
    // 2. Format with attribution
    const finalResponse = formatAttributedResponse(
      groundedResult.verified_fact, 
      'Local Retailer Search API'
    );
    
    expect(finalResponse).toContain('According to Local Retailer Search API');
    expect(finalResponse).toContain('$3.49');
  });
});
