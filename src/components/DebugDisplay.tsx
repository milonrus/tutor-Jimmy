'use client';

import { useState } from 'react';

interface DebugInfo {
  logFile: string | null;
  timestamp: string;
}

interface DebugDisplayProps {
  debugInfo: DebugInfo;
}

export default function DebugDisplay({ debugInfo }: DebugDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!debugInfo || !debugInfo.logFile) {
    return null;
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

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
              <span className="text-sm font-medium text-gray-600">Request Timestamp:</span>
              <span className="text-sm text-gray-800 font-mono">
                {formatTimestamp(debugInfo.timestamp)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Debug Log File:</span>
              <span className="text-sm text-gray-800 font-mono bg-gray-100 px-2 py-1 rounded">
                logs/{debugInfo.logFile}
              </span>
            </div>

            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                💡 The debug log contains: input text, system prompt, OpenAI request/response, and processed output.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                📁 Find the complete log file in your project&apos;s <code className="bg-gray-200 px-1 rounded">logs/</code> directory.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}