import { optimizeMemory, addObservationToMemory } from './memoryContext';

describe('Memory Optimization', () => {
  it('should trigger summarization when object count exceeds 20', () => {
    let memory: string[] = [];
    // Use a larger limit for addObservationToMemory to allow optimization threshold to be hit
    for (let i = 0; i < 21; i++) {
      memory = addObservationToMemory(memory, `Spotted item ${i}`, 100);
    }

    const result = optimizeMemory(memory);
    expect(result.isSummarized).toBe(true);
    expect(result.summary).toContain('Looked at 21 different cereals');
    expect(result.memory.length).toBe(0); // Recent memory cleared after summary
  });

  it('should not summarize if count is <= 20', () => {
    const memory = ['item 1', 'item 2'];
    const result = optimizeMemory(memory);
    expect(result.isSummarized).toBe(false);
    expect(result.memory).toEqual(memory);
  });
});
