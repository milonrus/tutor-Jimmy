import { getModelConfig } from '@/config/openai-models';

// Support multiple possible usage object structures
export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  // Alternative field names that might be used
  input_tokens?: number;
  output_tokens?: number;
  // For OpenAI responses API (GPT-5, etc.)
  prompt_token_details?: {
    cached_tokens?: number;
    reasoning_tokens?: number;
  };
  completion_token_details?: {
    reasoning_tokens?: number;
    accepted_prediction_tokens?: number;
    rejected_prediction_tokens?: number;
  };
}

export interface CostBreakdown {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCostUSD: number;
  outputCostUSD: number;
  totalCostUSD: number;
  model: string;
}

/**
 * Calculate the cost of an OpenAI API call based on token usage and model
 */
export function calculateCost(usage: TokenUsage, modelId: string): CostBreakdown {
  const modelConfig = getModelConfig(modelId);

  if (!modelConfig) {
    throw new Error(`Model configuration not found for: ${modelId}`);
  }

  // Try to extract token counts from different possible field names
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  // Standard OpenAI chat completions format
  if (usage.prompt_tokens !== undefined) {
    inputTokens = usage.prompt_tokens;
  } else if (usage.input_tokens !== undefined) {
    // Alternative format
    inputTokens = usage.input_tokens;
  }

  if (usage.completion_tokens !== undefined) {
    outputTokens = usage.completion_tokens;
  } else if (usage.output_tokens !== undefined) {
    // Alternative format
    outputTokens = usage.output_tokens;
  }

  if (usage.total_tokens !== undefined) {
    totalTokens = usage.total_tokens;
  } else {
    // Calculate total if not provided
    totalTokens = inputTokens + outputTokens;
  }

  // If we still don't have input/output breakdown but have total, try to infer
  if (totalTokens > 0 && inputTokens === 0 && outputTokens === 0) {
    // For reasoning models, output is typically much larger than input
    // Use a reasonable estimation: ~20% input, ~80% output for reasoning tasks
    inputTokens = Math.floor(totalTokens * 0.2);
    outputTokens = totalTokens - inputTokens;
  }

  // Parse pricing strings (e.g., "$5.00" -> 5.00)
  const inputPricePerMillion = parseFloat(modelConfig.inputPricing.replace('$', ''));
  const outputPricePerMillion = parseFloat(modelConfig.outputPricing.replace('$', ''));

  // Calculate costs (pricing is per 1M tokens)
  const inputCostUSD = (inputTokens / 1_000_000) * inputPricePerMillion;
  const outputCostUSD = (outputTokens / 1_000_000) * outputPricePerMillion;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    inputCostUSD: Number(inputCostUSD.toFixed(6)), // 6 decimal places for precision
    outputCostUSD: Number(outputCostUSD.toFixed(6)),
    totalCostUSD: Number(totalCostUSD.toFixed(6)),
    model: modelId
  };
}

/**
 * Format cost as USD currency string
 */
export function formatCost(costUSD: number): string {
  if (costUSD < 0.01) {
    // For very small amounts, show more precision
    return `$${costUSD.toFixed(6)}`;
  } else if (costUSD < 0.1) {
    return `$${costUSD.toFixed(4)}`;
  } else {
    return `$${costUSD.toFixed(2)}`;
  }
}

/**
 * Format token count with thousands separators
 */
export function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

/**
 * Calculate cost per token for a model
 */
export function getCostPerToken(modelId: string): { input: number; output: number } {
  const modelConfig = getModelConfig(modelId);

  if (!modelConfig) {
    return { input: 0, output: 0 };
  }

  const inputPricePerMillion = parseFloat(modelConfig.inputPricing.replace('$', ''));
  const outputPricePerMillion = parseFloat(modelConfig.outputPricing.replace('$', ''));

  return {
    input: inputPricePerMillion / 1_000_000,
    output: outputPricePerMillion / 1_000_000
  };
}