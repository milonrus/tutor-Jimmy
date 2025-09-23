'use client';

import { useState } from 'react';

interface Correction {
  original: string;
  corrected: string;
  type: string;
  explanation?: string;
  startIndex: number;
  endIndex: number;
}

interface CorrectionDisplayProps {
  originalText: string;
  corrections: Correction[];
}

export default function CorrectionDisplay({ originalText, corrections }: CorrectionDisplayProps) {
  const [viewMode, setViewMode] = useState<'highlighted' | 'details'>('highlighted');

  const renderCorrectionsWithStrikethrough = () => {
    if (corrections.length === 0) {
      return <span className="whitespace-pre-wrap">{originalText}</span>;
    }

    const sortedCorrections = [...corrections].sort((a, b) => a.startIndex - b.startIndex);
    const segments = [];
    let currentIndex = 0;

    sortedCorrections.forEach((correction, index) => {
      // Add text before the error
      if (correction.startIndex > currentIndex) {
        segments.push(
          <span key={`text-${index}`} className="whitespace-pre-wrap">
            {originalText.slice(currentIndex, correction.startIndex)}
          </span>
        );
      }

      // Add the correction with strikethrough and replacement
      segments.push(
        <span key={`correction-${index}`} className="inline">
          <span className="line-through text-red-500 bg-red-50 whitespace-pre-wrap">
            {correction.original}
          </span>
          <span className="text-green-600 bg-green-50 ml-1 font-medium whitespace-pre-wrap">
            {correction.corrected}
          </span>
        </span>
      );

      currentIndex = correction.endIndex;
    });

    // Add remaining text
    if (currentIndex < originalText.length) {
      segments.push(
        <span key="text-end" className="whitespace-pre-wrap">
          {originalText.slice(currentIndex)}
        </span>
      );
    }

    return segments;
  };

  const renderCorrectionsList = () => {
    if (corrections.length === 0) {
      return <div className="text-gray-500 italic">No corrections needed!</div>;
    }

    return (
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-700 mb-3">
          {corrections.length} correction{corrections.length > 1 ? 's' : ''} made:
        </h3>
        {corrections.map((correction, index) => (
          <div key={index} className="bg-gray-50 p-3 rounded-lg border-l-4 border-blue-400">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-medium">
                {correction.type}
              </span>
            </div>
            <div className="mb-2">
              <span className="line-through text-red-600">{correction.original}</span>
              <span className="mx-2 text-gray-400">→</span>
              <span className="text-green-600 font-medium">{correction.corrected}</span>
            </div>
            {correction.explanation && (
              <div className="text-sm text-gray-600 italic">
                {correction.explanation}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="flex gap-2 border-b border-gray-200 pb-4">
        <button
          onClick={() => setViewMode('highlighted')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'highlighted'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Show Errors
        </button>
        <button
          onClick={() => setViewMode('details')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'details'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Error Details
        </button>
      </div>

      {/* Content Display */}
      {viewMode === 'highlighted' && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Original Text with Identified Errors:</h3>
          <div className="leading-relaxed">
            {renderCorrectionsWithStrikethrough()}
          </div>
        </div>
      )}

      {viewMode === 'details' && (
        <div>
          {renderCorrectionsList()}
        </div>
      )}
    </div>
  );
}