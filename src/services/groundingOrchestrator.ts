import { GROCERY_TOOL_SCHEMA, MEDICAL_TOOL_SCHEMA } from './searchTools';

export interface OrchestrationContext {
  scenario: string;
  query: string;
}

export interface ToolCallResult {
  tool: string;
  args: any;
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
      args: { item: 'milk' } // Mocked extraction
    };
  } else if (context.scenario === 'medical') {
    return {
      tool: MEDICAL_TOOL_SCHEMA.name,
      args: { drug: 'aspirin' } // Mocked extraction
    };
  } else {
    throw new Error('Unknown scenario');
  }
}
