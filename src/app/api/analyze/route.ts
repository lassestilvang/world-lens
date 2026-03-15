import { NextRequest, NextResponse } from 'next/server';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({
  region: 'us-east-1',
});

const NOVA_LITE_MODEL_ID =
  process.env.NOVA_LITE_INFERENCE_PROFILE_ARN || 'amazon.nova-2-lite-v1:0';

interface AnalyzeRequest {
  image: string; // base64-encoded JPEG
  mode: 'grocery' | 'document' | 'medication' | 'environment';
  question?: string;
}

function getPromptForMode(mode: string, question?: string): string {
  const baseRules = `
CRITICAL RULES:
1. If text is blurry or partially obscured, you MUST state "I cannot read this clearly". Do NOT guess or interpolate missing words.
2. Only list objects you are highly confident exist in the frame.
3. Include a confidence score (0-1) for each extracted field and omit low-confidence entities.
4. If confidence is low for safety-critical content, say so instead of guessing.
`;

  switch (mode) {
    case 'grocery':
      return `Analyze the image of a grocery store or product shelf.

Describe:
- objects present (product names, brands)
- visible text (labels, prices)
- environment type

Return your response as valid JSON with this exact structure:
{"objects": ["string"], "text": "string", "environment": "string", "confidence": 0.0}

${baseRules}
${question ? `\nThe user specifically asks: "${question}"` : ''}`;

    case 'document':
      return `Perform high-precision OCR on this document image.

Identify the document type and extract all visible text.

Return your response as valid JSON with this exact structure:
{"fullText": "string", "documentType": "string", "confidence": 0.0}

${baseRules}`;

    case 'medication':
      return `Analyze the image of a medication label.

Describe:
- medication name
- strength (e.g., 400mg)
- dosage instructions

Return your response as valid JSON with this exact structure:
{"name": "string", "strength": "string", "dosage": "string", "confidence": 0.0}

${baseRules}
ADDITIONAL SAFETY RULE: If ANY dosage information is unclear, you MUST state "I cannot read this clearly. Please do not guess." Do NOT interpolate missing dosage data.`;

    case 'environment':
      return `Analyze the environment in this image for safety-critical objects and general context.

Identify:
- safety-critical objects (traffic lights, crossings, obstacles, vehicles, warning signs)
- general scene context (location type, conditions)

Return your response as valid JSON with this exact structure:
{"safetyObjects": ["string"], "sceneContext": "string", "confidence": 0.0}

${baseRules}`;

    default:
      return `Analyze this image. Return JSON with "objects", "text", "environment", and "confidence" fields.\n${baseRules}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();

    if (!body.image) {
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
    }

    if (!body.mode) {
      return NextResponse.json({ error: 'Mode is required' }, { status: 400 });
    }

    // Strip the data URL prefix if present (e.g., "data:image/jpeg;base64,")
    const base64Data = body.image.includes(',')
      ? body.image.split(',')[1]
      : body.image;

    const imageBytes = Buffer.from(base64Data, 'base64');

    const command = new ConverseCommand({
      modelId: NOVA_LITE_MODEL_ID,
      messages: [
        {
          role: 'user',
          content: [
            {
              image: {
                format: 'jpeg',
                source: { bytes: imageBytes },
              },
            },
            {
              text: getPromptForMode(body.mode, body.question),
            },
          ],
        },
      ],
      inferenceConfig: {
        maxTokens: 1024,
        temperature: 0.2,
      },
    });

    const response = await client.send(command);

    // Extract the text response from Converse API
    const textContent = response.output?.message?.content?.find(
      (c) => 'text' in c
    );
    const responseText = textContent && 'text' in textContent ? textContent.text : '';

    // Try to parse as JSON, fall back to raw text
    let parsed;
    try {
      // Try direct parse first
      parsed = JSON.parse(responseText || '{}');
    } catch {
      try {
        // Strip markdown code fences (```json ... ```)
        const stripped = responseText?.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
        parsed = JSON.parse(stripped || '{}');
      } catch {
        try {
          // Last resort: regex extraction of first JSON object
          const jsonMatch = responseText?.match(/\{[\s\S]*\}/);
          parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: responseText };
        } catch {
          parsed = { raw: responseText };
        }
      }
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[/api/analyze] Error:', error);

    // Categorize the error for appropriate client response
    const errorName = (error as { name?: string })?.name || '';
    const errorMessage = error instanceof Error ? error.message : 'Analysis failed';

    // AWS credential / auth errors
    if (
      errorName === 'CredentialsProviderError' ||
      errorName === 'ExpiredTokenException' ||
      errorMessage.includes('reauthenticate') ||
      errorMessage.includes('expired') ||
      errorMessage.includes('security token') ||
      errorMessage.includes('credentials')
    ) {
      return NextResponse.json(
        {
          error: 'AWS credentials are missing or expired. Please reauthenticate.',
          code: 'CREDENTIALS_ERROR',
        },
        { status: 401 }
      );
    }

    // Throttling / rate-limit errors
    if (
      errorName === 'ThrottlingException' ||
      errorName === 'TooManyRequestsException' ||
      errorMessage.includes('Rate exceeded')
    ) {
      return NextResponse.json(
        {
          error: 'Too many requests — please wait a moment and try again.',
          code: 'THROTTLED',
        },
        { status: 429 }
      );
    }

    // Model / validation errors
    if (
      errorName === 'ValidationException' ||
      errorName === 'ModelNotReadyException' ||
      errorName === 'AccessDeniedException'
    ) {
      return NextResponse.json(
        {
          error: `Model error: ${errorMessage}`,
          code: 'MODEL_ERROR',
        },
        { status: 400 }
      );
    }

    // Generic fallback
    return NextResponse.json(
      {
        error: 'Analysis failed — please try again.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
