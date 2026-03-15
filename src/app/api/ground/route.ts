import { NextRequest, NextResponse } from 'next/server';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const NOVA_LITE_MODEL_ID = 'us.amazon.nova-lite-v1:0';

interface GroundRequest {
  query: string;
  context?: string; // visual context from scene analysis
  scenario?: 'grocery' | 'medical' | 'general';
}

/**
 * POST /api/ground
 * Uses Nova Lite to reason about and verify visual observations.
 * Simplified grounding for hackathon MVP (no full Nova Act browser automation).
 */
export async function POST(request: NextRequest) {
  try {
    const body: GroundRequest = await request.json();

    if (!body.query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const prompt = buildGroundingPrompt(body);

    const command = new ConverseCommand({
      modelId: NOVA_LITE_MODEL_ID,
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        maxTokens: 512,
        temperature: 0.1,
      },
    });

    const response = await client.send(command);

    const textContent = response.output?.message?.content?.find(
      (c) => 'text' in c
    );
    const responseText = textContent && 'text' in textContent ? textContent.text : '';

    // Try to parse structured response
    let parsed;
    try {
      const jsonMatch = responseText?.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { verified_fact: responseText, source: 'Nova Lite reasoning' };
    } catch {
      parsed = { verified_fact: responseText, source: 'Nova Lite reasoning' };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[/api/ground] Error:', error);

    // Graceful fallback as per the failure-mode matrix
    return NextResponse.json({
      verified_fact: null,
      source: null,
      fallback: true,
      message: 'External verification could not be completed. Answer is based only on visible text.',
    });
  }
}

function buildGroundingPrompt(req: GroundRequest): string {
  let prompt = `You are a fact-verification assistant. Your job is to evaluate the following claim or question using your knowledge and provide a grounded, verified response.

RULES:
1. Only state facts you are confident about.
2. If you are uncertain, say "I cannot verify this with high confidence."
3. Always cite the basis for your answer (e.g., "Based on general nutritional knowledge..." or "Based on the visible label text...").
4. For medical information, ALWAYS include: "Please consult a healthcare professional for definitive advice."

Return your response as valid JSON: {"verified_fact": "string", "confidence": 0.0, "source": "string"}

`;

  if (req.context) {
    prompt += `Visual context from the scene:\n${req.context}\n\n`;
  }

  prompt += `Question/Claim to verify:\n${req.query}`;

  return prompt;
}
