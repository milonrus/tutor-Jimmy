'use client';

import { OPENAI_MODELS, MODEL_RECOMMENDATIONS } from '@/config/openai-models';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  className?: string;
}

export default function ModelSelector({ selectedModel, onModelChange, className = '' }: ModelSelectorProps) {
  const grammarModels = MODEL_RECOMMENDATIONS.grammarCorrection;

  return (
    <div className={`space-y-3 ${className}`}>
      <label htmlFor="model-select" className="block text-sm font-medium text-gray-700">
        AI Model
      </label>
      <div className="relative">
        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <optgroup label="Recommended for Grammar">
            {grammarModels.map((modelId) => {
              const model = OPENAI_MODELS[modelId];
              if (!model) {
                console.warn(`Model ${modelId} not found in OPENAI_MODELS`);
                return null;
              }
              return (
                <option key={modelId} value={modelId}>
                  {model.name} - {model.inputPricing}/1M tokens
                </option>
              );
            }).filter(Boolean)}
          </optgroup>
          <optgroup label="All Models">
            {Object.entries(OPENAI_MODELS)
              .filter(([id]) => !grammarModels.includes(id))
              .map(([modelId, model]) => (
                <option key={modelId} value={modelId}>
                  {model.name} - {model.inputPricing}/1M tokens
                </option>
              ))}
          </optgroup>
        </select>
      </div>

      {/* Model info display */}
      {selectedModel && OPENAI_MODELS[selectedModel] && (
        <div className="p-3 bg-gray-50 rounded-lg text-sm">
          <div className="font-medium text-gray-700">{OPENAI_MODELS[selectedModel].name}</div>
          <div className="text-gray-600 mt-1">{OPENAI_MODELS[selectedModel].description}</div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span>Context: {OPENAI_MODELS[selectedModel].contextLength.toLocaleString()} tokens</span>
            <span>Input: {OPENAI_MODELS[selectedModel].inputPricing}/1M</span>
            <span>Output: {OPENAI_MODELS[selectedModel].outputPricing}/1M</span>
          </div>
        </div>
      )}
    </div>
  );
}