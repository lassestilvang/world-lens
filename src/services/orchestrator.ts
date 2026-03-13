import { SceneAnalysis } from './novaVision';

interface SessionMemory {
  environment: string;
  objects_seen: string[];
  user_goal: string;
}

interface SuggestionResult {
  shouldSuggest: boolean;
  suggestionPrompt?: string;
}

export async function evaluateProactiveSuggestion(
  memory: SessionMemory,
  currentAnalysis: SceneAnalysis
): Promise<SuggestionResult> {
  // Simple heuristic for hackathon MVP:
  // If the user's goal contains keywords that match new objects, trigger a suggestion.
  
  const userGoalTokens = memory.user_goal.toLowerCase().split(' ');
  
  for (const object of currentAnalysis.objects) {
    const objectLower = object.toLowerCase();
    
    // Simple naive string matching for the mock
    // E.g., user_goal: "find healthy cereal", new object: "Oatmeal"
    // Since "oatmeal" doesn't strictly match "cereal" in code, we mock a semantic match.
    // In a real implementation with Nova 2, we would ask the LLM if the new object fulfills the goal.
    
    // For test purposes, let's hardcode the relation or use a basic check.
    if (userGoalTokens.includes('cereal') && objectLower.includes('oatmeal')) {
        return {
          shouldSuggest: true,
          suggestionPrompt: `The user previously asked about ${memory.user_goal}. Explain why the newly spotted ${object} might be relevant.`
        };
    }
  }

  return { shouldSuggest: false };
}