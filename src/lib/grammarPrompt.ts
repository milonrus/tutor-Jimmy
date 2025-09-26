import { readFile } from 'fs/promises';
import { join } from 'path';

const FALLBACK_PROMPT = `You are a grammar correction assistant. Analyze the provided text and return a JSON response with detailed correction information.

For each error found, provide:
1. The original incorrect text segment
2. The corrected version
3. The type of error (spelling, grammar, punctuation, style)
4. A brief explanation (only for non-obvious errors)

Return a JSON object with this structure:
{
  "correctedText": "full corrected text",
  "corrections": [
    {
      "original": "original incorrect text",
      "corrected": "corrected text",
      "type": "error type",
      "explanation": "explanation if needed"
    }
  ]
}

Rules:
- Respond with valid JSON only (no code fences or commentary)
- Only provide explanations for non-obvious errors (not simple spelling mistakes)
- Keep explanations concise (max 20 words)
- Include all types of corrections: spelling, grammar, punctuation, style
- Maintain original meaning and tone`;

const SIMPLE_FALLBACK_PROMPT = `You are a professional English editor. Your task is to correct all grammar, spelling, punctuation, and style errors in the provided text.

Instructions:
- Fix all errors while preserving the original meaning and tone
- Use US English conventions
- Return ONLY the corrected text with no additional commentary, explanations, or formatting
- Do not add or remove content unless it's necessary for grammatical correctness
- Maintain the original paragraph structure and line breaks

Please correct the following text:`;

let cachedPrompt: string | null = null;
let loadingPromise: Promise<string> | null = null;

let cachedSimplePrompt: string | null = null;
let simpleLoadingPromise: Promise<string> | null = null;

export async function getGrammarCorrectionPrompt(): Promise<string> {
  if (cachedPrompt) {
    return cachedPrompt;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  const promptPath = join(process.cwd(), 'src', 'prompts', 'grammar-correction.txt');

  loadingPromise = readFile(promptPath, 'utf-8')
    .then(content => {
      cachedPrompt = content;
      return content;
    })
    .catch(error => {
      console.error('Failed to read grammar prompt file:', error);
      cachedPrompt = FALLBACK_PROMPT;
      return FALLBACK_PROMPT;
    })
    .finally(() => {
      loadingPromise = null;
    });

  return loadingPromise;
}

export async function getSimpleGrammarCorrectionPrompt(): Promise<string> {
  if (cachedSimplePrompt) {
    return cachedSimplePrompt;
  }

  if (simpleLoadingPromise) {
    return simpleLoadingPromise;
  }

  const promptPath = join(process.cwd(), 'src', 'prompts', 'grammar-correction-simple.md');

  simpleLoadingPromise = readFile(promptPath, 'utf-8')
    .then(content => {
      cachedSimplePrompt = content;
      return content;
    })
    .catch(error => {
      console.error('Failed to read simple grammar prompt file:', error);
      cachedSimplePrompt = SIMPLE_FALLBACK_PROMPT;
      return SIMPLE_FALLBACK_PROMPT;
    })
    .finally(() => {
      simpleLoadingPromise = null;
    });

  return simpleLoadingPromise;
}

export function getFallbackGrammarPrompt(): string {
  return FALLBACK_PROMPT;
}

export function getSimpleFallbackGrammarPrompt(): string {
  return SIMPLE_FALLBACK_PROMPT;
}
