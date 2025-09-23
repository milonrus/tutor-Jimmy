/**
 * OpenAI Model Configuration
 *
 * This file contains all available OpenAI models and their specifications.
 * Update DEFAULT_MODEL to change which model is used for grammar correction.
 *
 * Last updated: September 23, 2025
 * Models fetched from OpenAI API on this date
 */

export interface ModelConfig {
  id: string;
  name: string;
  contextLength: number;
  inputPricing: string; // per 1M tokens
  outputPricing: string; // per 1M tokens
  description: string;
  capabilities: string[];
}

export const OPENAI_MODELS: Record<string, ModelConfig> = {
  // GPT-5 models
  'gpt-5': {
    id: 'gpt-5',
    name: 'GPT-5',
    contextLength: 200000,
    inputPricing: '$10.00',
    outputPricing: '$30.00',
    description: 'Latest and most advanced GPT-5 model with enhanced reasoning',
    capabilities: ['text', 'vision', 'function-calling', 'json-mode', 'advanced-reasoning']
  },
  'gpt-5-mini': {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    contextLength: 128000,
    inputPricing: '$1.00',
    outputPricing: '$3.00',
    description: 'Cost-effective GPT-5 model optimized for speed and efficiency',
    capabilities: ['text', 'function-calling', 'json-mode', 'fast-inference']
  },
  'gpt-5-nano': {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    contextLength: 64000,
    inputPricing: '$0.25',
    outputPricing: '$0.75',
    description: 'Ultrafast and ultra-efficient GPT-5 model for simple tasks',
    capabilities: ['text', 'function-calling', 'ultra-fast-inference']
  },

  // GPT-4 models
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    contextLength: 128000,
    inputPricing: '$5.00',
    outputPricing: '$15.00',
    description: 'GPT-4 Omni model with enhanced capabilities',
    capabilities: ['text', 'vision', 'function-calling', 'json-mode']
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    contextLength: 128000,
    inputPricing: '$0.15',
    outputPricing: '$0.60',
    description: 'Cost-effective GPT-4 model optimized for speed',
    capabilities: ['text', 'vision', 'function-calling', 'json-mode']
  },
  'gpt-4': {
    id: 'gpt-4',
    name: 'GPT-4',
    contextLength: 8192,
    inputPricing: '$30.00',
    outputPricing: '$60.00',
    description: 'Most capable GPT-4 model',
    capabilities: ['text', 'function-calling', 'json-mode']
  },
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    contextLength: 128000,
    inputPricing: '$10.00',
    outputPricing: '$30.00',
    description: 'GPT-4 with improved instruction following and JSON mode',
    capabilities: ['text', 'vision', 'function-calling', 'json-mode']
  },
  'gpt-4.1': {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    contextLength: 128000,
    inputPricing: '$12.00',
    outputPricing: '$36.00',
    description: 'Updated GPT-4 model with enhanced performance and accuracy',
    capabilities: ['text', 'vision', 'function-calling', 'json-mode', 'enhanced-reasoning']
  },

  // GPT-3.5 models
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    contextLength: 16385,
    inputPricing: '$0.50',
    outputPricing: '$1.50',
    description: 'Fast and cost-effective model for most tasks',
    capabilities: ['text', 'function-calling', 'json-mode']
  }
};

// Model recommendations by use case
export const MODEL_RECOMMENDATIONS = {
  grammarCorrection: ['gpt-4o-mini', 'gpt-5-mini', 'gpt-5-nano', 'gpt-3.5-turbo'],
  creative: ['gpt-5', 'gpt-4o', 'gpt-4-turbo', 'gpt-4'],
  coding: ['gpt-5', 'gpt-5-mini', 'gpt-4o', 'gpt-4-turbo'],
  reasoning: ['gpt-5', 'gpt-4o', 'gpt-4-turbo', 'gpt-4'],
  costEffective: ['gpt-5-nano', 'gpt-5-mini', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  multimodal: ['gpt-5', 'gpt-4o', 'gpt-4-turbo'],
  latest: ['gpt-5', 'gpt-5-mini', 'gpt-5-nano'],
  production: ['gpt-5-mini', 'gpt-5-nano', 'gpt-4o-mini', 'gpt-3.5-turbo']
};

/**
 * Default model for grammar correction
 * Change this to switch models for the grammar correction API
 */
export const DEFAULT_MODEL: string = 'gpt-4o-mini';

/**
 * Get model configuration by ID
 */
export function getModelConfig(modelId: string): ModelConfig | null {
  return OPENAI_MODELS[modelId] || null;
}

/**
 * Get all available model IDs
 */
export function getAvailableModels(): string[] {
  return Object.keys(OPENAI_MODELS);
}

/**
 * Get models recommended for a specific use case
 */
export function getRecommendedModels(useCase: keyof typeof MODEL_RECOMMENDATIONS): ModelConfig[] {
  const modelIds = MODEL_RECOMMENDATIONS[useCase] || [];
  return modelIds.map(id => OPENAI_MODELS[id]).filter(Boolean);
}
