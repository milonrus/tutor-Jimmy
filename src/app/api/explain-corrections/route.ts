import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import OpenAI from 'openai';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { DEFAULT_MODEL, ReasoningEffort, getModelConfig } from '@/config/openai-models';
import { calculateCost, type TokenUsage, type CostBreakdown } from '@/lib/costCalculator';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface Correction {
  original: string;
  corrected: string;
  type: string;
  explanation?: string;
  startIndex: number;
  endIndex: number;
}

interface ExplanationRequest {
  originalText: string;
  correctedText: string;
  corrections: Correction[];
  model?: string;
  reasoningEffort?: ReasoningEffort;
  userId?: string;
}

interface ExplanationResponse {
  corrections: Correction[];
  debug?: {
    model: string;
    reasoningEffort?: string;
    usage: unknown;
    explanationsAdded: number;
  };
}

async function logDebugInfo(data: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    try {
      const logsDir = join('/tmp', 'grammar-tutor-logs');
      await mkdir(logsDir, { recursive: true });

      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        type: 'explanation_request',
        ...data
      };

      const logFile = join(logsDir, `explanation-${new Date().toISOString().split('T')[0]}.log`);
      await writeFile(logFile, JSON.stringify(logEntry, null, 2) + '\n', { flag: 'a' });
    } catch (error) {
      console.error('Debug info (file write failed):', JSON.stringify(data, null, 2));
      console.error('Error details:', error);
    }
  }
}

function buildExplanationPrompt(originalText: string, correctedText: string, corrections: Correction[]): string {
  const correctionsText = corrections
    .filter(c => !c.explanation) // Only explain corrections without explanations
    .map((c, i) => `${i + 1}. "${c.original}" → "${c.corrected}" (${c.type})`)
    .join('\n');

  if (!correctionsText) {
    return '';
  }

  return `You are a grammar tutor providing concise explanations for specific corrections.

Original text: "${originalText}"
Corrected text: "${correctedText}"

Corrections to explain:
${correctionsText}

For each correction, provide a brief explanation (max 15 words) explaining WHY the change was made. Focus on the grammatical rule, spelling error, or style improvement.

Rules:
- Skip obvious spelling corrections unless there's a learning point
- Focus on grammar rules for grammar corrections
- Be educational but concise
- Use simple, clear language

Respond with a JSON object where each key is "original → corrected" and each value is the explanation:
{
  "original1 → corrected1": "explanation",
  "original2 → corrected2": "explanation"
}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      originalText,
      correctedText,
      corrections,
      model: requestedModel,
      reasoningEffort,
      userId
    }: ExplanationRequest = body;

    if (!originalText || !correctedText || !corrections || !Array.isArray(corrections)) {
      return NextResponse.json(
        { error: 'Original text, corrected text, and corrections array are required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Filter corrections that need explanations
    const correctionsNeedingExplanations = corrections.filter(c => !c.explanation);

    if (correctionsNeedingExplanations.length === 0) {
      await logDebugInfo({
        type: 'no_explanations_needed',
        correctionsCount: corrections.length
      });

      return NextResponse.json({
        corrections,
        debug: process.env.NODE_ENV === 'development' ? {
          model: requestedModel || DEFAULT_MODEL,
          explanationsAdded: 0
        } : undefined
      });
    }

    const selectedModelId = typeof requestedModel === 'string' && getModelConfig(requestedModel)
      ? requestedModel
      : DEFAULT_MODEL;

    const selectedModelConfig = getModelConfig(selectedModelId);
    const supportsReasoning = Boolean(selectedModelConfig?.supportsReasoning);

    const validReasoningEfforts: ReasoningEffort[] = ['minimal', 'low', 'medium', 'high'];
    const requestedEffortIsValid = typeof reasoningEffort === 'string'
      && (validReasoningEfforts as string[]).includes(reasoningEffort);

    const resolvedReasoningEffort: ReasoningEffort | undefined = supportsReasoning
      ? (requestedEffortIsValid ? reasoningEffort : 'low')
      : undefined;

    const explanationPrompt = buildExplanationPrompt(originalText, correctedText, corrections);

    await logDebugInfo({
      type: 'request',
      model: selectedModelId,
      reasoningEffort: resolvedReasoningEffort,
      correctionsToExplain: correctionsNeedingExplanations.length,
      totalCorrections: corrections.length
    });

    let explanationsText = '';
    let usage: unknown;

    if (supportsReasoning) {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await client.responses.create({
        model: selectedModelId,
        reasoning: resolvedReasoningEffort ? { effort: resolvedReasoningEffort } : undefined,
        input: [
          {
            role: 'user' as const,
            content: [
              {
                type: 'input_text' as const,
                text: explanationPrompt
              }
            ]
          }
        ]
      });

      type ResponseOutput = {
        output_text?: string | null;
        output?: Array<{
          content?: Array<{
            type?: string;
            text?: string;
          }>;
        }>;
        usage?: unknown;
      };

      const responseData = JSON.parse(JSON.stringify(response)) as ResponseOutput;

      const aggregatedText = responseData.output_text ?? '';
      if (aggregatedText.trim().length > 0) {
        explanationsText = aggregatedText.trim();
      } else if (Array.isArray(responseData.output)) {
        const extractPartText = (part: unknown): string => {
          if (!part || typeof part !== 'object') return '';

          const candidate = part as { type?: unknown; text?: unknown; content?: unknown };
          const { type } = candidate;
          const maybeText = (value: unknown) => typeof value === 'string' ? value : '';

          if (type === 'output_text' || type === 'text' || type === 'reasoning' || type === 'summary_text') {
            const direct = maybeText(candidate.text);
            if (direct) return direct;

            if (Array.isArray(candidate.content)) {
              return candidate.content.map(extractPartText).join('');
            }
          }

          if (Array.isArray(candidate.content)) {
            return candidate.content.map(extractPartText).join('');
          }

          return '';
        };

        explanationsText = responseData.output
          .flatMap(item => Array.isArray(item.content) ? item.content : [])
          .map(part => extractPartText(part))
          .join('')
          .trim();
      }

      usage = responseData.usage;
    } else {
      const result = await generateText({
        model: openai(selectedModelId),
        prompt: explanationPrompt,
        providerOptions: resolvedReasoningEffort ? {
          openai: {
            reasoningEffort: resolvedReasoningEffort
          }
        } : undefined,
      });

      explanationsText = result.text.trim();
      usage = result.usage;
    }

    await logDebugInfo({
      type: 'openai_response',
      model: selectedModelId,
      reasoningEffort: resolvedReasoningEffort,
      explanationsText: explanationsText.substring(0, 200) + '...',
      usage
    });

    // Parse explanations from AI response
    let explanationsMap: Record<string, string> = {};
    try {
      // Try to extract JSON from the response
      const jsonMatch = explanationsText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        explanationsMap = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse explanations JSON:', parseError);
      await logDebugInfo({
        type: 'parse_error',
        error: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        rawResponse: explanationsText
      });
    }

    // Apply explanations to corrections
    const updatedCorrections = corrections.map(correction => {
      if (correction.explanation) {
        return correction; // Already has explanation
      }

      const key = `${correction.original} → ${correction.corrected}`;
      const explanation = explanationsMap[key];

      return explanation ? { ...correction, explanation } : correction;
    });

    const explanationsAdded = updatedCorrections.filter(c => c.explanation).length -
                             corrections.filter(c => c.explanation).length;

    await logDebugInfo({
      type: 'explanations_applied',
      explanationsAdded,
      totalCorrections: corrections.length
    });

    const response: ExplanationResponse = {
      corrections: updatedCorrections,
      debug: process.env.NODE_ENV === 'development' ? {
        model: selectedModelId,
        reasoningEffort: resolvedReasoningEffort,
        usage,
        explanationsAdded
      } : undefined
    };

    // Save explanation request to Firestore if user is authenticated
    if (userId) {
      try {
        const firestoreData = {
          userId,
          originalText,
          correctedText,
          correctionsCount: corrections.length,
          explanationsAdded,
          model: selectedModelId,
          ...(resolvedReasoningEffort && { reasoningEffort: resolvedReasoningEffort }),
          timestamp: serverTimestamp(),
          createdAt: serverTimestamp(),
        };

        await addDoc(collection(db, 'explanations'), firestoreData);

        await logDebugInfo({
          type: 'firestore_save',
          userId,
          explanationsAdded,
          saved: true
        });
      } catch (firestoreError) {
        console.error('Error saving explanation to Firestore:', firestoreError);
        await logDebugInfo({
          type: 'firestore_error',
          error: firestoreError instanceof Error ? firestoreError.message : 'Unknown Firestore error'
        });
      }
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Explanation API error:', error);

    try {
      await logDebugInfo({
        type: 'error',
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    let errorMessage = 'Failed to generate explanations';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = 'Configuration error: API key issue';
        statusCode = 500;
      } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
        errorMessage = 'Service temporarily unavailable due to rate limits';
        statusCode = 429;
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        errorMessage = 'Network error: Please try again';
        statusCode = 503;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        debug: process.env.NODE_ENV === 'development' ? {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        } : undefined
      },
      { status: statusCode }
    );
  }
}