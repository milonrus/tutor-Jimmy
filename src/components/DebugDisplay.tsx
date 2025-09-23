'use client';

import { useState } from 'react';

interface DebugInfo {
  model: string;
  usage: unknown;
  xmlResponse: string;
  parsedCorrections: number;
}

interface DebugDisplayProps {
  debugInfo: DebugInfo;
  xmlText: string;
}

export default function DebugDisplay({ debugInfo, xmlText }: DebugDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!debugInfo) {
    return null;
  }

  return (
    <div className="mt-4 bg-gray-100 border border-gray-300 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 text-left bg-gray-200 hover:bg-gray-300 transition-colors flex justify-between items-center"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">🐛 Debug Information</span>
          <span className="text-xs text-gray-500 bg-gray-300 px-2 py-1 rounded">
            DEV MODE
          </span>
        </div>
        <span className="text-gray-500">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>

      {isExpanded && (
        <div className="p-4 bg-white border-t border-gray-300">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Model Used:</span>
              <span className="text-sm text-gray-800 font-mono">
                {debugInfo.model}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Corrections Found:</span>
              <span className="text-sm text-gray-800 font-mono">
                {debugInfo.parsedCorrections}
              </span>
            </div>

            <div className="pt-2 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-600">XML Response:</span>
              <pre className="text-xs text-gray-800 font-mono bg-gray-100 p-2 rounded mt-1 max-h-40 overflow-y-auto">
                {debugInfo.xmlResponse}
              </pre>
            </div>

            <div className="pt-2 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-600">Processed XML:</span>
              <pre className="text-xs text-gray-800 font-mono bg-gray-100 p-2 rounded mt-1 max-h-40 overflow-y-auto">
                {xmlText}
              </pre>
            </div>

            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                💡 Debug information shows the AI model response and how it was processed.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}