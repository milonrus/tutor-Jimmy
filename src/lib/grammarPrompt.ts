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

let cachedPrompt: string | null = null;
let loadingPromise: Promise<string> | null = null;

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

export function getFallbackGrammarPrompt(): string {
  return FALLBACK_PROMPT;
}
