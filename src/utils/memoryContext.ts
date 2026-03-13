/**
 * Adds an observation to the memory array, maintaining a maximum limit.
 * Older observations are dropped if the limit is exceeded.
 * @param currentMemory Current list of observations
 * @param newObservation The new observation to add
 * @param maxItems Maximum number of items to keep in memory (default 20)
 * @returns Updated memory array
 */
export function addObservationToMemory(
  currentMemory: string[],
  newObservation: string,
  maxItems: number = 20
): string[] {
  const updatedMemory = [...currentMemory, newObservation];
  
  if (updatedMemory.length > maxItems) {
    // Keep only the most recent `maxItems`
    return updatedMemory.slice(updatedMemory.length - maxItems);
  }
  
  return updatedMemory;
}

/**
 * Builds a formatted context string from an array of memory observations.
 * @param memory The array of memory observation strings
 * @returns A formatted string
 */
export function buildMemoryContext(memory: string[]): string {
  if (memory.length === 0) {
    return "No recent observations.";
  }
  
  return "Recent observations:\n" + memory.map(m => `- ${m}`).join("\n");
}