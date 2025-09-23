import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { DEFAULT_MODEL } from '@/config/openai-models';
import { getGrammarCorrectionPrompt } from '@/lib/grammarPrompt';
import {
  Correction,
  CorrectionResponse,
  CorrectionResponseSchema,
} from './schema';

interface CorrectionRequest {
  text: string;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text }: CorrectionRequest = body;

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

    const systemPrompt = await getGrammarCorrectionPrompt();

    await logDebugInfo({
      type: 'request',
      model: DEFAULT_MODEL,
      inputText: text,
      systemPrompt: systemPrompt.substring(0, 200) + '...'
    });

    const result = await generateObject({
      model: openai(DEFAULT_MODEL),
      schema: CorrectionResponseSchema,
      system: systemPrompt,
      prompt: `Please analyze and correct the following text:\n\n${text}`,
      maxOutputTokens: 800,
    });

    await logDebugInfo({
      type: 'openai_response',
      model: DEFAULT_MODEL,
      response: result.object,
      usage: result.usage
    });

    const parsedResponse: CorrectionResponse = result.object;

    const correctionsWithPositions = findPositions(text, parsedResponse.corrections);

    const response = {
      corrections: correctionsWithPositions,
      debug: process.env.NODE_ENV === 'development' ? {
        model: DEFAULT_MODEL,
        usage: result.usage,
        originalCorrections: parsedResponse.corrections,
        calculatedPositions: correctionsWithPositions.length !== parsedResponse.corrections.length
      } : undefined
    };

    await logDebugInfo({
      type: 'final_response',
      response
    });

    return NextResponse.json(response);

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

    return NextResponse.json(
      {
        error: 'Failed to process grammar correction',
        debug: process.env.NODE_ENV === 'development' ? {
          error: error instanceof Error ? error.message : 'Unknown error'
        } : undefined
      },
      { status: 500 }
    );
  }
}
