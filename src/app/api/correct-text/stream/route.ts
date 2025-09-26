import { NextRequest } from 'next/server';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { DEFAULT_MODEL } from '@/config/openai-models';
import { getGrammarCorrectionPrompt } from '@/lib/grammarPrompt';
import { checkRateLimit } from '@/lib/rateLimiting';
import {
  Correction,
  CorrectionResponse,
  CorrectionResponseSchema,
} from '../schema';

interface CorrectionRequest {
  text: string;
  model?: string;
  userId?: string;
  isAnonymous?: boolean;
}

function findPositions(originalText: string, corrections: Correction[]): Correction[] {
  return corrections.map(correction => {
    const index = originalText.indexOf(correction.original);
    return {
      ...correction,
      startIndex: index !== -1 ? index : 0,
      endIndex: index !== -1 ? index + correction.original.length : correction.original.length
    };
  });
}

async function logDebugInfo(data: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    try {
      const logsDir = join(process.cwd(), 'logs');
      await mkdir(logsDir, { recursive: true });

      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        ...data
      };

      const logFile = join(logsDir, `grammar-correction-${new Date().toISOString().split('T')[0]}.log`);
      await writeFile(logFile, JSON.stringify(logEntry, null, 2) + '\n', { flag: 'a' });
    } catch (error) {
      console.error('Failed to write debug log:', error);
    }
  }
}

function createStatusEvent(step: number, totalSteps: number, message: string, details?: string) {
  return `data: ${JSON.stringify({ step, totalSteps, message, details })}\n\n`;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {

      (async () => {
        try {
          const body = await request.json();
          const { text, model, userId, isAnonymous }: CorrectionRequest = body;
          const selectedModel = model || DEFAULT_MODEL;
          const totalSteps = 9; // Increased for rate limit check

          // Step 1: Rate limit check
          if (!userId) {
            controller.enqueue(encoder.encode(createStatusEvent(1, totalSteps, 'Error: User ID is required', 'Authentication required')));
            controller.close();
            return;
          }

          if (isAnonymous) {
            controller.enqueue(encoder.encode(createStatusEvent(1, totalSteps, 'Checking rate limits...', 'Verifying request quota')));

            const rateLimitResult = await checkRateLimit(userId, isAnonymous);

            if (!rateLimitResult.allowed) {
              controller.enqueue(encoder.encode(createStatusEvent(1, totalSteps, 'Rate limit exceeded', `You've reached the limit of 3 requests per week. Sign up for unlimited access! Resets: ${rateLimitResult.resetTime.toISOString()}`)));
              controller.close();
              return;
            }
          }

          // Step 2: Validation
          controller.enqueue(encoder.encode(createStatusEvent(2, totalSteps, 'Validating input text...', `Checking ${text.length} characters`)));

          if (!text || typeof text !== 'string') {
            controller.enqueue(encoder.encode(createStatusEvent(2, totalSteps, 'Error: Invalid text input', 'Text is required and must be a string')));
            controller.close();
            return;
          }

          if (!process.env.OPENAI_API_KEY) {
            controller.enqueue(encoder.encode(createStatusEvent(2, totalSteps, 'Error: OpenAI API key not configured', 'Please check your environment variables')));
            controller.close();
            return;
          }

          // Step 3: Loading prompt
          controller.enqueue(encoder.encode(createStatusEvent(3, totalSteps, 'Loading grammar correction prompt...', 'Using cached template if available')));

          const systemPrompt = await getGrammarCorrectionPrompt();

          // Step 4: Logging request
          controller.enqueue(encoder.encode(createStatusEvent(4, totalSteps, 'Preparing request...', `Model: ${selectedModel}`)));

          await logDebugInfo({
            type: 'request',
            model: selectedModel,
            inputText: text,
            systemPrompt: systemPrompt.substring(0, 200) + '...'
          });

          // Step 5: Connecting to OpenAI
          controller.enqueue(encoder.encode(createStatusEvent(5, totalSteps, 'Connecting to OpenAI API...', 'Establishing secure connection')));

          // Step 6: Sending to AI model
          controller.enqueue(encoder.encode(createStatusEvent(6, totalSteps, 'Sending text to AI model for analysis...', `Processing with ${selectedModel} (optimized for structured JSON output)`)));

          const result = await generateObject({
            model: openai(selectedModel),
            schema: CorrectionResponseSchema,
            system: systemPrompt,
            prompt: `Please analyze and correct the following text:\n\n${text}`,
            temperature: 0.2,
          });

          const serializedResponse = JSON.stringify(result.object);

          // Step 7: Receiving response
          controller.enqueue(encoder.encode(createStatusEvent(7, totalSteps, 'Receiving response from OpenAI...', `Received ${serializedResponse.length} characters`)));

          await logDebugInfo({
            type: 'openai_response',
            model: selectedModel,
            response: result.object,
            usage: result.usage
          });

          // Step 8: Parsing response
          controller.enqueue(encoder.encode(createStatusEvent(8, totalSteps, 'Parsing correction suggestions...', 'Structured response validated')));

          const parsedResponse: CorrectionResponse = result.object;

          // Step 9: Finalizing
          controller.enqueue(encoder.encode(createStatusEvent(9, totalSteps, 'Calculating error positions...', `Found ${parsedResponse.corrections.length} corrections`)));

          const correctionsWithPositions = findPositions(text, parsedResponse.corrections);

          const response = {
            corrections: correctionsWithPositions,
            debug: process.env.NODE_ENV === 'development' ? {
              model: selectedModel,
              usage: result.usage,
              originalCorrections: parsedResponse.corrections,
              calculatedPositions: correctionsWithPositions.length !== parsedResponse.corrections.length
            } : undefined
          };

          await logDebugInfo({
            type: 'final_response',
            response
          });

          // Send final success status
          controller.enqueue(encoder.encode(createStatusEvent(9, totalSteps, `Complete! Found ${correctionsWithPositions.length} corrections`, 'Grammar analysis finished successfully')));

          // Send the final result
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', data: response })}\n\n`));
          controller.close();

        } catch (error) {
          console.error('Grammar correction API error:', error);

          await logDebugInfo({
            type: 'error',
            error: error instanceof Error ? {
              message: error.message,
              stack: error.stack,
              name: error.name
            } : error
          });

          controller.enqueue(encoder.encode(createStatusEvent(0, 9, 'Error: Failed to process grammar correction', error instanceof Error ? error.message : 'Unknown error')));
          controller.close();
        }
      })();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
