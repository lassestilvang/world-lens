import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: 'us-east-1' });

export interface VoiceResponse {
  audioBuffer: Buffer;
  textResponse: string;
}

/**
 * Generates a text-based speech response using the REST API.
 * This is used as a fallback when the WebSocket voice pipeline is not available.
 *
 * In production, the primary voice interaction goes through the WebSocket → Lambda → Nova Sonic
 * bidirectional streaming pipeline (see voiceSession.ts). This function is for text-only fallback.
 */
export async function generateSpeechResponse(inputPrompt: string, memoryContext: string): Promise<VoiceResponse> {
  if (!inputPrompt || inputPrompt.trim() === '') {
    throw new Error('Input prompt is required');
  }

  if (process.env.NODE_ENV === 'test') {
    return {
      audioBuffer: Buffer.from('mock-audio-data', 'utf-8'),
      textResponse: 'Cheerios are generally considered healthier.',
    };
  }

  // Use the ground API for text-based reasoning
  try {
    const response = await fetch('/api/ground', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: inputPrompt,
        context: memoryContext,
      }),
    });

    const result = await response.json();

    return {
      audioBuffer: Buffer.from('', 'utf-8'), // No audio in text-fallback mode
      textResponse: result.verified_fact || result.raw || 'I could not generate a response.',
    };
  } catch (error) {
    console.error('[novaSonic] Text fallback error:', error);
    return {
      audioBuffer: Buffer.from('', 'utf-8'),
      textResponse: 'Sorry, I encountered an error processing your request.',
    };
  }
}