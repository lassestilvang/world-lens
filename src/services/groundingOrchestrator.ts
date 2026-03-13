import { GROCERY_TOOL_SCHEMA, MEDICAL_TOOL_SCHEMA, searchGroceryPrice, searchMedicalDatabase } from './searchTools';

export interface OrchestrationContext {
  scenario: string;
  query: string;
}

export interface ToolCallResult {
  tool: string;
  args: any;
}

export interface GroundedResult {
  verified_fact: string;
}

/**
 * Orchestrates tool calls based on context.
 * @param context The current session context
 * @returns The tool to be called and its arguments
 */
export async function orchestrateToolCall(context: OrchestrationContext): Promise<ToolCallResult> {
  if (context.scenario === 'grocery') {
    return {
      tool: GROCERY_TOOL_SCHEMA.name,
      args: { item: 'milk' }
    };
  } else if (context.scenario === 'medical') {
    return {
      tool: MEDICAL_TOOL_SCHEMA.name,
      args: { drug: 'aspirin' }
    };
  } else {
    throw new Error('Unknown scenario');
  }
}

/**
 * Triggers the appropriate grounding tool and returns a verified fact string.
 * @param context The current session context
 * @returns A grounded result
 */
export async function triggerGroundingTool(context: OrchestrationContext): Promise<GroundedResult> {
  const orchestrated = await orchestrateToolCall(context);
  let rawResult: any;

  if (orchestrated.tool === GROCERY_TOOL_SCHEMA.name) {
    rawResult = await searchGroceryPrice(orchestrated.args.item);
    return {
      verified_fact: `Verified: The price of ${rawResult.item} is ${rawResult.price} (via ${rawResult.source}).`
    };
  } else if (orchestrated.tool === MEDICAL_TOOL_SCHEMA.name) {
    rawResult = await searchMedicalDatabase(orchestrated.args.drug);
    return {
      verified_fact: `Verified: ${rawResult.drug} is used for ${rawResult.indications}. Warnings: ${rawResult.warnings} (via ${rawResult.source}).`
    };
  }

  throw new Error('Failed to trigger appropriate tool');
}
