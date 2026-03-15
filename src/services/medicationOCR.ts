export interface MedicationInfo {
  name: string;
  strength: string;
  dosage: string;
  confidence: number;
}

export function getMedicationPrompt(): string {
  return `
Analyze the image of the medication label.

Describe:
- medication name
- strength (e.g., 400mg)
- dosage instructions (e.g., take 1 tablet every 4-6 hours)

CRITICAL RULES:
1. If text is blurry or partially obscured, you MUST state "I cannot read this clearly". Do NOT guess or interpolate missing words.
2. Only list information you are highly confident exists in the frame.
3. Include confidence for each extracted field and omit low-confidence entities.
4. If confidence is low for safety-critical content, request a clearer frame instead of answering.
`;
}

export const MIN_CONFIDENCE_THRESHOLD = 0.95;

export function isConfidenceHighEnough(confidence: number): boolean {
  return confidence >= MIN_CONFIDENCE_THRESHOLD;
}

export async function extractMedicationInfo(base64Image: string): Promise<MedicationInfo> {
  if (!base64Image) {
    throw new Error('Image data is required');
  }

  // In a real application, we would call Nova 2 Lite here.
  /*
  const command = new InvokeModelCommand({
    modelId: 'amazon.nova-lite-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [
            { image: { format: 'jpeg', source: { bytes: base64Image } } },
            { text: getMedicationPrompt() }
          ]
        }
      ]
    })
  });
  const response = await client.send(command);
  // Parse response.body
  */

  // Mocked response for test suite
  return {
    name: 'Ibuprofen',
    strength: '400mg',
    dosage: 'Take 1 tablet every 4-6 hours while symptoms persist.',
    confidence: 0.98
  };
}
