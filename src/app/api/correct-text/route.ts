import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const getGrammarPrompt = () => {
  const promptPath = join(process.cwd(), 'src', 'prompts', 'grammar-correction.txt');
  return readFileSync(promptPath, 'utf-8').trim();
};

const saveDebugLog = (debugData: any) => {
  if (process.env.NODE_ENV !== 'development') return null;

  try {
    const logsDir = join(process.cwd(), 'logs');

    // Ensure logs directory exists
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }

    // Create filename with timestamp and short hash
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const hash = createHash('md5').update(debugData.inputText + Date.now()).digest('hex').slice(0, 8);
    const filename = `${timestamp}_${hash}.json`;
    const filepath = join(logsDir, filename);

    // Save debug data
    writeFileSync(filepath, JSON.stringify(debugData, null, 2), 'utf-8');

    return filename;
  } catch (error) {
    console.error('Failed to save debug log:', error);
    return null;
  }
};

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

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

    const systemPrompt = getGrammarPrompt();
    const requestTimestamp = new Date().toISOString();

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const responseContent = completion.choices[0]?.message?.content || text;

    try {
      // Try to parse the response as JSON
      const correctionData = JSON.parse(responseContent);
      console.log('OpenAI Response:', JSON.stringify(correctionData, null, 2));

      // Add indices if missing
      if (correctionData.corrections && Array.isArray(correctionData.corrections)) {
        correctionData.corrections = correctionData.corrections.map((correction: any, index: number) => {
          if (typeof correction.startIndex !== 'number' || typeof correction.endIndex !== 'number') {
            // Find the position of this correction in the original text
            const originalIndex = text.indexOf(correction.original);
            return {
              ...correction,
              startIndex: originalIndex >= 0 ? originalIndex : index * 10,
              endIndex: originalIndex >= 0 ? originalIndex + correction.original.length : (index * 10) + correction.original.length
            };
          }
          return correction;
        });
      }

      // Save debug log in development
      const debugData = {
        timestamp: requestTimestamp,
        inputText: text,
        systemPrompt: systemPrompt,
        openAiRequest: {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          max_tokens: 1000,
          temperature: 0.1
        },
        openAiResponse: {
          raw: responseContent,
          parsed: correctionData,
          usage: completion.usage
        },
        processedOutput: correctionData
      };

      const logFilename = saveDebugLog(debugData);

      // Add debug info to response in development
      if (process.env.NODE_ENV === 'development') {
        correctionData._debug = {
          logFile: logFilename,
          timestamp: requestTimestamp
        };
      }

      return NextResponse.json(correctionData);
    } catch {
      // Fallback: if response is not JSON, return as plain corrected text
      console.warn('Failed to parse JSON response, falling back to plain text');

      const fallbackData = {
        correctedText: responseContent,
        corrections: []
      };

      // Save debug log even for fallback case
      const debugData = {
        timestamp: requestTimestamp,
        inputText: text,
        systemPrompt: systemPrompt,
        openAiRequest: {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          max_tokens: 1000,
          temperature: 0.1
        },
        openAiResponse: {
          raw: responseContent,
          parsed: null,
          parseError: 'Failed to parse as JSON',
          usage: completion.usage
        },
        processedOutput: fallbackData
      };

      const logFilename = saveDebugLog(debugData);

      // Add debug info to response in development
      if (process.env.NODE_ENV === 'development') {
        fallbackData._debug = {
          logFile: logFilename,
          timestamp: requestTimestamp
        };
      }

      return NextResponse.json(fallbackData);
    }
  } catch (error) {
    console.error('Error correcting text:', error);
    return NextResponse.json(
      { error: 'Failed to correct text' },
      { status: 500 }
    );
  }
}