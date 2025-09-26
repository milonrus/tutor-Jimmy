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
import { checkRateLimit } from '@/lib/rateLimiting';
import { analyzeDifferences } from '@/lib/diffAnalysis';
import { getSimpleGrammarCorrectionPrompt } from '@/lib/grammarPrompt';


interface CorrectionRequest {
  text: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  userId?: string;
  isAnonymous?: boolean;
}

interface Correction {
  original: string;
  corrected: string;
  type: string;
  explanation?: string;
  startIndex: number;
  endIndex: number;
}

interface CorrectionResponse {
  corrections: Correction[];
  originalText: string;
  xmlText: string;
  debug?: {
    model: string;
    reasoningEffort?: string;
    usage: unknown;
    xmlResponse: string;
    parsedCorrections: number;
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
        type: 'simple_correction',
        ...data
      };

      const logFile = join(logsDir, `grammar-correction-simple-${new Date().toISOString().split('T')[0]}.log`);
      await writeFile(logFile, JSON.stringify(logEntry, null, 2) + '\n', { flag: 'a' });
    } catch (error) {
      console.error('Debug info (file write failed):', JSON.stringify(data, null, 2));
      console.error('Error details:', error);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, model: requestedModel, reasoningEffort, userId, isAnonymous }: CorrectionRequest = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check rate limits for anonymous users
    if (isAnonymous) {
      const rateLimitResult = await checkRateLimit(userId, isAnonymous);

      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: `You've reached the limit of ${3} requests per week. Sign up for unlimited access!`,
            resetTime: rateLimitResult.resetTime.toISOString(),
            remainingRequests: 0
          },
          { status: 429 }
        );
      }

      await logDebugInfo({
        type: 'rate_limit_check',
        userId,
        remainingRequests: rateLimitResult.remainingRequests,
        resetTime: rateLimitResult.resetTime
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
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
      ? (requestedEffortIsValid ? reasoningEffort : 'medium')
      : undefined;

    // Get the simple grammar correction prompt
    const systemPrompt = await getSimpleGrammarCorrectionPrompt();

    await logDebugInfo({
      type: 'request',
      model: selectedModelId,
      reasoningEffort: resolvedReasoningEffort,
      inputText: text.substring(0, 200) + '...',
      method: 'simple_correction',
      systemPrompt: systemPrompt.substring(0, 200) + '...'
    });

    let correctedText = '';
    let usage: unknown;

    if (supportsReasoning) {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await client.responses.create({
        model: selectedModelId,
        reasoning: resolvedReasoningEffort ? { effort: resolvedReasoningEffort } : undefined,
        input: [
          {
            role: 'system' as const,
            content: [
              {
                type: 'input_text' as const,
                text: systemPrompt
              }
            ]
          },
          {
            role: 'user' as const,
            content: [
              {
                type: 'input_text' as const,
                text
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
        correctedText = aggregatedText.trim();
      } else if (Array.isArray(responseData.output)) {
        const extractPartText = (part: unknown): string => {
          if (!part || typeof part !== 'object') {
            return '';
          }

          const candidate = part as { type?: unknown; text?: unknown; content?: unknown };
          const { type } = candidate;

          const maybeText = (value: unknown) => typeof value === 'string' ? value : '';

          if (type === 'output_text' || type === 'text' || type === 'reasoning' || type === 'summary_text') {
            const direct = maybeText(candidate.text);
            if (direct) {
              return direct;
            }

            if (Array.isArray(candidate.content)) {
              return candidate.content.map(extractPartText).join('');
            }
          }

          if (Array.isArray(candidate.content)) {
            return candidate.content.map(extractPartText).join('');
          }

          return '';
        };

        const fallback = responseData.output
          .flatMap(item => Array.isArray(item.content) ? item.content : [])
          .map(part => extractPartText(part))
          .join('')
          .trim();
        correctedText = fallback;
      }

      usage = responseData.usage;

      await logDebugInfo({
        type: 'openai_response',
        model: selectedModelId,
        reasoningEffort: resolvedReasoningEffort,
        correctedText: correctedText.substring(0, 200) + '...',
        usage: responseData.usage
      });
    } else {
      const result = await generateText({
        model: openai(selectedModelId),
        system: systemPrompt,
        prompt: text,
        providerOptions: resolvedReasoningEffort ? {
          openai: {
            reasoningEffort: resolvedReasoningEffort
          }
        } : undefined,
      });

      correctedText = result.text.trim();
      usage = result.usage;

      await logDebugInfo({
        type: 'openai_response',
        model: selectedModelId,
        reasoningEffort: resolvedReasoningEffort,
        correctedText: correctedText.substring(0, 200) + '...',
        usage: result.usage
      });
    }

    // Analyze differences between original and corrected text
    const diffResult = analyzeDifferences(text, correctedText);

    const response: CorrectionResponse = {
      corrections: diffResult.corrections,
      originalText: text,
      xmlText: correctedText, // Store corrected text in xmlText field for consistency
      debug: process.env.NODE_ENV === 'development' ? {
        model: selectedModelId,
        reasoningEffort: resolvedReasoningEffort,
        usage,
        xmlResponse: correctedText,
        parsedCorrections: diffResult.corrections.length
      } : undefined
    };

    // Calculate cost breakdown from token usage
    let costBreakdown: CostBreakdown | null = null;
    try {
      if (usage && typeof usage === 'object' && usage !== null) {
        const tokenUsage = usage as TokenUsage;
        costBreakdown = calculateCost(tokenUsage, selectedModelId);

        await logDebugInfo({
          type: 'cost_calculation_success',
          costBreakdown,
          model: selectedModelId
        });
      }
    } catch (error) {
      console.error('Error calculating cost:', error);
      await logDebugInfo({
        type: 'cost_calculation_error',
        error: error instanceof Error ? error.message : 'Unknown cost calculation error',
        usage,
        model: selectedModelId
      });
    }

    // Save to Firestore if user is authenticated
    if (userId) {
      try {
        const firestoreData = {
          userId,
          originalText: text,
          correctedText,
          corrections: diffResult.corrections,
          model: selectedModelId,
          correctionMethod: 'simple_diff',
          ...(resolvedReasoningEffort && { reasoningEffort: resolvedReasoningEffort }),
          timestamp: serverTimestamp(),
          createdAt: serverTimestamp(),
          ...(costBreakdown && {
            inputTokens: costBreakdown.inputTokens,
            outputTokens: costBreakdown.outputTokens,
            totalTokens: costBreakdown.totalTokens,
            inputCostUSD: costBreakdown.inputCostUSD,
            outputCostUSD: costBreakdown.outputCostUSD,
            totalCostUSD: costBreakdown.totalCostUSD
          })
        };

        await addDoc(collection(db, 'corrections'), firestoreData);

        await logDebugInfo({
          type: 'firestore_save',
          userId,
          correctionsCount: diffResult.corrections.length,
          costBreakdown,
          saved: true
        });
      } catch (firestoreError) {
        console.error('Error saving to Firestore:', firestoreError);
        await logDebugInfo({
          type: 'firestore_error',
          error: firestoreError instanceof Error ? firestoreError.message : 'Unknown Firestore error'
        });
      }
    }

    await logDebugInfo({
      type: 'final_response',
      correctionsFound: diffResult.corrections.length,
      method: 'simple_diff'
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Simple grammar correction API error:', error);

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

    let errorMessage = 'Failed to process grammar correction';
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