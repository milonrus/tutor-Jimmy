'use client';

import { useState, useRef, useEffect } from 'react';
import { OPENAI_MODELS, MODEL_RECOMMENDATIONS, REASONING_EFFORT_OPTIONS, ReasoningEffort } from '@/config/openai-models';

export type CorrectionMode = 'detailed' | 'quick';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  reasoningEffort?: ReasoningEffort;
  onReasoningChange?: (effort: ReasoningEffort) => void;
  correctionMode?: CorrectionMode;
  onCorrectionModeChange?: (mode: CorrectionMode) => void;
  className?: string;
  isAuthenticated?: boolean;
}

export default function ModelSelector({
  selectedModel,
  onModelChange,
  reasoningEffort = 'medium',
  onReasoningChange,
  correctionMode = 'quick',
  onCorrectionModeChange,
  className = '',
  isAuthenticated = false
}: ModelSelectorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hoveredDisabledOption, setHoveredDisabledOption] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const grammarModels = MODEL_RECOMMENDATIONS.grammarCorrection;
  const supportsReasoning = Boolean(OPENAI_MODELS[selectedModel]?.supportsReasoning);

  // For non-authenticated users, only allow GPT-5 nano
  const allowedModels = isAuthenticated ? Object.keys(OPENAI_MODELS) : ['gpt-5-nano'];

  // Track mouse position for tooltip
  const handleMouseMove = (event: MouseEvent) => {
    setMousePosition({ x: event.clientX, y: event.clientY });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setShowTooltip(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Organize models for display
  const grammarModelsList = grammarModels.map(id => ({ ...OPENAI_MODELS[id], id })).filter(Boolean);
  const otherModelsList = Object.entries(OPENAI_MODELS)
    .filter(([id]) => !grammarModels.includes(id))
    .map(([id, model]) => ({ ...model, id }));

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Correction Mode Toggle */}
      {onCorrectionModeChange && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Correction Mode
          </label>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => onCorrectionModeChange('quick')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                correctionMode === 'quick'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Quick Mode
            </button>
            <button
              type="button"
              onClick={() => onCorrectionModeChange('detailed')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                correctionMode === 'detailed'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Learning Mode
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {correctionMode === 'quick'
              ? 'Fast, reliable corrections with GitHub-style highlighting'
              : 'Detailed corrections with explanations and error types'
            }
          </p>
        </div>
      )}

      <label className="block text-sm font-medium text-gray-700">
        AI Model
      </label>
      <div
        ref={dropdownRef}
        className="relative"
        onMouseEnter={() => !isAuthenticated && setShowTooltip(true)}
        onMouseLeave={() => {
          if (!isDropdownOpen && !hoveredDisabledOption) {
            setShowTooltip(false);
          }
        }}
      >
        {/* Custom dropdown trigger */}
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-left flex justify-between items-center"
        >
          <span>
            {OPENAI_MODELS[selectedModel]?.name} - {OPENAI_MODELS[selectedModel]?.inputPricing}/1M tokens
          </span>
          <svg className={`w-5 h-5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Custom dropdown menu */}
        {isDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
            {/* Recommended for Grammar section */}
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b">
              Recommended for Grammar
            </div>
            {grammarModelsList.map((model) => {
              const isAllowed = allowedModels.includes(model.id);
              return (
                <div
                  key={model.id}
                  onClick={() => {
                    if (isAllowed) {
                      onModelChange(model.id);
                      setIsDropdownOpen(false);
                      setShowTooltip(false);
                    }
                  }}
                  onMouseEnter={() => {
                    if (!isAllowed && !isAuthenticated) {
                      setHoveredDisabledOption(true);
                      setShowTooltip(true);
                    }
                  }}
                  onMouseLeave={() => {
                    if (!isAllowed) {
                      setHoveredDisabledOption(false);
                      setShowTooltip(false);
                    }
                  }}
                  className={`px-3 py-2 hover:bg-gray-50 cursor-pointer ${
                    !isAllowed ? 'text-gray-400 cursor-not-allowed' : 'text-gray-900'
                  } ${selectedModel === model.id ? 'bg-blue-50 text-blue-600' : ''}`}
                >
                  {model.name} - {model.inputPricing}/1M tokens
                </div>
              );
            })}

            {/* All Models section */}
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-t">
              All Models
            </div>
            {otherModelsList.map((model) => {
              const isAllowed = allowedModels.includes(model.id);
              return (
                <div
                  key={model.id}
                  onClick={() => {
                    if (isAllowed) {
                      onModelChange(model.id);
                      setIsDropdownOpen(false);
                      setShowTooltip(false);
                    }
                  }}
                  onMouseEnter={() => {
                    if (!isAllowed && !isAuthenticated) {
                      setHoveredDisabledOption(true);
                      setShowTooltip(true);
                    }
                  }}
                  onMouseLeave={() => {
                    if (!isAllowed) {
                      setHoveredDisabledOption(false);
                      setShowTooltip(false);
                    }
                  }}
                  className={`px-3 py-2 hover:bg-gray-50 cursor-pointer ${
                    !isAllowed ? 'text-gray-400 cursor-not-allowed' : 'text-gray-900'
                  } ${selectedModel === model.id ? 'bg-blue-50 text-blue-600' : ''}`}
                >
                  {model.name} - {model.inputPricing}/1M tokens
                </div>
              );
            })}
          </div>
        )}

        {/* Tooltip that follows mouse */}
        {!isAuthenticated && showTooltip && (
          <div
            className="fixed px-3 py-2 bg-gray-800 text-white text-sm rounded-lg pointer-events-none whitespace-nowrap z-50 shadow-lg"
            style={{
              left: mousePosition.x + 10,
              top: mousePosition.y - 40,
            }}
          >
            Log in to use advanced models
          </div>
        )}
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

      {supportsReasoning && onReasoningChange && (
        <div className="space-y-2">
          <label htmlFor="reasoning-select" className="block text-sm font-medium text-gray-700">
            Reasoning Effort
          </label>
          <select
            id="reasoning-select"
            value={reasoningEffort}
            onChange={(event) => onReasoningChange(event.target.value as ReasoningEffort)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            {REASONING_EFFORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            {REASONING_EFFORT_OPTIONS.find((option) => option.value === reasoningEffort)?.description}
          </p>
        </div>
      )}
    </div>
  );
}
