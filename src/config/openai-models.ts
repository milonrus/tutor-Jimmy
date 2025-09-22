/**
 * OpenAI Model Configuration
 *
 * This file contains all available OpenAI models and their specifications.
 * Update DEFAULT_MODEL to change which model is used for grammar correction.
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
  // GPT-4o models (latest, most capable)
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    contextLength: 128000,
    inputPricing: '$2.50',
    outputPricing: '$10.00',
    description: 'Most advanced model, multimodal capabilities',
    capabilities: ['text', 'vision', 'audio', 'function-calling', 'json-mode']
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    contextLength: 128000,
    inputPricing: '$0.15',
    outputPricing: '$0.60',
    description: 'Affordable, intelligent small model',
    capabilities: ['text', 'vision', 'function-calling', 'json-mode']
  },

  // GPT-4 Turbo models
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    contextLength: 128000,
    inputPricing: '$10.00',
    outputPricing: '$30.00',
    description: 'Previous generation flagship model',
    capabilities: ['text', 'vision', 'function-calling', 'json-mode']
  },
  'gpt-4-turbo-preview': {
    id: 'gpt-4-turbo-preview',
    name: 'GPT-4 Turbo Preview',
    contextLength: 128000,
    inputPricing: '$10.00',
    outputPricing: '$30.00',
    description: 'Preview version of GPT-4 Turbo',
    capabilities: ['text', 'function-calling', 'json-mode']
  },

  // GPT-4 models
  'gpt-4': {
    id: 'gpt-4',
    name: 'GPT-4',
    contextLength: 8192,
    inputPricing: '$30.00',
    outputPricing: '$60.00',
    description: 'Original GPT-4 model',
    capabilities: ['text', 'function-calling']
  },
  'gpt-4-32k': {
    id: 'gpt-4-32k',
    name: 'GPT-4 32K',
    contextLength: 32768,
    inputPricing: '$60.00',
    outputPricing: '$120.00',
    description: 'GPT-4 with extended context',
    capabilities: ['text', 'function-calling']
  },

  // GPT-3.5 Turbo models
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    contextLength: 16385,
    inputPricing: '$0.50',
    outputPricing: '$1.50',
    description: 'Fast, cost-effective model for most tasks',
    capabilities: ['text', 'function-calling', 'json-mode']
  },
  'gpt-3.5-turbo-instruct': {
    id: 'gpt-3.5-turbo-instruct',
    name: 'GPT-3.5 Turbo Instruct',
    contextLength: 4096,
    inputPricing: '$1.50',
    outputPricing: '$2.00',
    description: 'Instruction-following model',
    capabilities: ['text', 'completion-style']
  },

  // O1 models (reasoning models)
  'o1-preview': {
    id: 'o1-preview',
    name: 'O1 Preview',
    contextLength: 128000,
    inputPricing: '$15.00',
    outputPricing: '$60.00',
    description: 'Advanced reasoning model (preview)',
    capabilities: ['text', 'advanced-reasoning', 'complex-problem-solving']
  },
  'o1-mini': {
    id: 'o1-mini',
    name: 'O1 Mini',
    contextLength: 128000,
    inputPricing: '$3.00',
    outputPricing: '$12.00',
    description: 'Faster reasoning model for coding and math',
    capabilities: ['text', 'reasoning', 'coding', 'math']
  }
};

// Model recommendations by use case
export const MODEL_RECOMMENDATIONS = {
  grammarCorrection: ['gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-4o'],
  creative: ['gpt-4o', 'gpt-4-turbo', 'gpt-4'],
  coding: ['o1-mini', 'gpt-4o', 'gpt-4o-mini'],
  reasoning: ['o1-preview', 'o1-mini', 'gpt-4o'],
  costEffective: ['gpt-4o-mini', 'gpt-3.5-turbo'],
  multimodal: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']
};

/**
 * Default model for grammar correction
 * Change this to switch models for the grammar correction API
 */
export const DEFAULT_MODEL: string = 'gpt-3.5-turbo';

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

/**
 * Configuration for the grammar correction API
 */
export const GRAMMAR_CORRECTION_CONFIG = {
  model: DEFAULT_MODEL,
  maxTokens: 1000,
  temperature: 0.1,
  // You can add more configuration options here
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0
};