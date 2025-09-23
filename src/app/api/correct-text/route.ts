import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import OpenAI from 'openai';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { DEFAULT_MODEL, ReasoningEffort, getModelConfig } from '@/config/openai-models';
import { getGrammarCorrectionPrompt } from '@/lib/grammarPrompt';
import { parseXmlCorrections } from '@/lib/xmlCorrectionParser';
import { calculateCost, type TokenUsage, type CostBreakdown } from '@/lib/costCalculator';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import './schema';

const OPENAI_PROMPT_ID = process.env.OPENAI_PROMPT_ID ?? 'pmpt_68d1f6d23f388197946bfb143aa2fd1e00780713b8de1b8e';
const OPENAI_PROMPT_VERSION = process.env.OPENAI_PROMPT_VERSION ?? '1';
const OPENAI_PROMPT_VARIABLE_KEYS = (process.env.OPENAI_PROMPT_VARIABLE_KEYS ?? '')
  .split(',')
  .map(key => key.trim())
  .filter(key => key.length > 0);

interface CorrectionRequest {
  text: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  userId?: string;
}


async function logDebugInfo(data: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    try {
      // Use /tmp directory for production compatibility
      const logsDir = join('/tmp', 'grammar-tutor-logs');
      await mkdir(logsDir, { recursive: true });

      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        ...data
      };

      const logFile = join(logsDir, `grammar-correction-${new Date().toISOString().split('T')[0]}.log`);
      await writeFile(logFile, JSON.stringify(logEntry, null, 2) + '\n', { flag: 'a' });
    } catch (error) {
      // In production or if file writing fails, just log to console
      console.error('Debug info (file write failed):', JSON.stringify(data, null, 2));
      console.error('Error details:', error);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, model: requestedModel, reasoningEffort, userId }: CorrectionRequest = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      );
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

    const promptId = supportsReasoning ? OPENAI_PROMPT_ID?.trim() : undefined;
    const promptVersion = supportsReasoning ? OPENAI_PROMPT_VERSION?.trim() : undefined;
    const usePromptTemplate = Boolean(promptId);

    const systemPrompt = await getGrammarCorrectionPrompt();

    const availablePromptVariableValues: Record<string, string> = {
      text,
      instructions: systemPrompt,
      reasoning_effort: resolvedReasoningEffort ?? 'medium'
    };

    const promptVariables = OPENAI_PROMPT_VARIABLE_KEYS.reduce<Record<string, string>>((acc, entry) => {
      const [variableNameRaw, sourceKeyRaw] = entry.split(':');
      const variableName = (variableNameRaw ?? '').trim();
      const sourceKey = (sourceKeyRaw ?? variableNameRaw ?? '').trim();

      if (!variableName) {
        return acc;
      }

      const value = availablePromptVariableValues[sourceKey as keyof typeof availablePromptVariableValues];
      if (typeof value === 'string') {
        acc[variableName] = value;
      }

      return acc;
    }, {});

    const promptVariablesProvided = Object.keys(promptVariables).length > 0 ? promptVariables : undefined;

    await logDebugInfo({
      type: 'request',
      model: selectedModelId,
      reasoningEffort: resolvedReasoningEffort,
      inputText: text,
      systemPrompt: systemPrompt.substring(0, 200) + '...',
      promptId: usePromptTemplate ? promptId : undefined,
      promptVersion: usePromptTemplate ? promptVersion : undefined,
      promptVariables: promptVariablesProvided ? Object.keys(promptVariablesProvided) : undefined
    });

    let xmlText = '';
    let usage: unknown;

    if (supportsReasoning) {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      // const promptVariables: Record<string, string> = {
      //   text,
      //   instructions: systemPrompt,
      //   reasoning_effort: resolvedReasoningEffort ?? 'medium'
      // };

      const reasoningInputMessages = usePromptTemplate
        ? [
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
        : [
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
                  text: `Please analyze and correct the following text:\n\n${text}`
                }
              ]
            }
          ];

      const response = await client.responses.create({
        model: selectedModelId,
        reasoning: resolvedReasoningEffort ? { effort: resolvedReasoningEffort } : undefined,
        prompt: usePromptTemplate ? {
          id: promptId!,
          ...(promptVersion ? { version: promptVersion } : {}),
          variables: promptVariablesProvided
        } : undefined,
        input: reasoningInputMessages
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
        prompt_response?: unknown;
      };

      const responseData = JSON.parse(JSON.stringify(response)) as ResponseOutput;

      const aggregatedText = responseData.output_text ?? '';
      if (aggregatedText.trim().length > 0) {
        xmlText = aggregatedText.trim();
      } else if (Array.isArray(responseData.output)) {
        const extractPartText = (part: unknown): string => {
          if (!part || typeof part !== 'object') {
            return '';
          }

          const candidate = part as { type?: unknown; text?: unknown; content?: unknown; additional_text?: unknown };
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

            return maybeText(candidate.additional_text);
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
        xmlText = fallback;
      }

      usage = responseData.usage;

      await logDebugInfo({
        type: 'openai_raw_response',
        model: selectedModelId,
        reasoningEffort: resolvedReasoningEffort,
        response: responseData
      });

      await logDebugInfo({
        type: 'openai_response',
        model: selectedModelId,
        reasoningEffort: resolvedReasoningEffort,
        response: xmlText,
        usage: responseData.usage
      });
    } else {
      const result = await generateText({
        model: openai(selectedModelId),
        system: systemPrompt,
        prompt: `Please analyze and correct the following text:\n\n${text}`,
        providerOptions: resolvedReasoningEffort ? {
          openai: {
            reasoningEffort: resolvedReasoningEffort
          }
        } : undefined,
      });

      xmlText = result.text.trim();
      usage = result.usage;

      await logDebugInfo({
        type: 'openai_response',
        model: selectedModelId,
        reasoningEffort: resolvedReasoningEffort,
        response: xmlText,
        usage: result.usage
      });
    }

    const parsedResult = parseXmlCorrections(xmlText);

    const response = {
      corrections: parsedResult.corrections,
      originalText: parsedResult.originalText,
      xmlText: xmlText,
      debug: process.env.NODE_ENV === 'development' ? {
        model: selectedModelId,
        reasoningEffort: resolvedReasoningEffort,
        usage,
        xmlResponse: xmlText,
        parsedCorrections: parsedResult.corrections.length
      } : undefined
    };

    // Calculate cost breakdown from token usage
    let costBreakdown: CostBreakdown | null = null;
    try {
      if (usage && typeof usage === 'object' && usage !== null) {
        // Debug log the usage object structure
        await logDebugInfo({
          type: 'usage_object_debug',
          usage,
          model: selectedModelId,
          usageKeys: Object.keys(usage)
        });

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

    // Save to Firestore if user is authenticated (save all attempts, not just those with corrections)
    if (userId) {
      try {
        const firestoreData = {
          userId,
          originalText: text,
          correctedText: xmlText,
          corrections: parsedResult.corrections,
          model: selectedModelId,
          ...(resolvedReasoningEffort && { reasoningEffort: resolvedReasoningEffort }),
          timestamp: serverTimestamp(),
          createdAt: serverTimestamp(),
          // Add cost and token data
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
          correctionsCount: parsedResult.corrections.length,
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
    } else {
      await logDebugInfo({
        type: 'firestore_skip',
        reason: 'No userId provided',
        userId: userId || 'undefined'
      });
    }

    await logDebugInfo({
      type: 'final_response',
      response
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Grammar correction API error:', error);

    // Safe logging that won't cause additional errors
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

    // More specific error messages based on error type
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
