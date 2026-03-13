/**
 * @jest-environment node
 */
import { analyzeDocument } from './novaVision';

describe('novaVision - analyzeDocument', () => {
  it('should extract full text and identify document type', async () => {
    const mockImage = 'base64-document-image';
    const result = await analyzeDocument(mockImage);

    expect(result).toHaveProperty('fullText');
    expect(result).toHaveProperty('documentType');
    expect(result).toHaveProperty('confidence');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should throw error for empty image', async () => {
    await expect(analyzeDocument('')).rejects.toThrow('Invalid image data');
  });
});
