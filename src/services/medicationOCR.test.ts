import { getMedicationPrompt, isConfidenceHighEnough } from './medicationOCR';

describe('Medication OCR Utilities', () => {
  describe('getMedicationPrompt', () => {
    it('should return a prompt that includes specific instructions for medication labels', () => {
      const prompt = getMedicationPrompt();
      expect(prompt).toContain('medication name');
      expect(prompt).toContain('strength');
      expect(prompt).toContain('dosage instructions');
      expect(prompt).toContain('CRITICAL RULES');
    });
  });

  describe('isConfidenceHighEnough', () => {
    it('should return true if confidence is >= 0.95', () => {
      expect(isConfidenceHighEnough(0.95)).toBe(true);
      expect(isConfidenceHighEnough(0.99)).toBe(true);
    });

    it('should return false if confidence is < 0.95', () => {
      expect(isConfidenceHighEnough(0.94)).toBe(false);
      expect(isConfidenceHighEnough(0.5)).toBe(false);
    });
  });
});
