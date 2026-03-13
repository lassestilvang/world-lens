/**
 * @jest-environment node
 */
import { searchMedicationDatabase } from './medicationGrounding';

describe('Medication Grounding Service - searchMedicationDatabase', () => {
  it('should return verified medication data for a valid query', async () => {
    const query = 'Ibuprofen 400mg';
    const result = await searchMedicationDatabase(query);

    expect(result).toHaveProperty('verifiedName');
    expect(result).toHaveProperty('verifiedStrength');
    expect(result).toHaveProperty('officialDosageInstructions');
    expect(result).toHaveProperty('source');
    expect(result.verifiedName.toLowerCase()).toContain('ibuprofen');
  });

  it('should throw error for empty query', async () => {
    await expect(searchMedicationDatabase('')).rejects.toThrow('Search query is required');
  });
});
