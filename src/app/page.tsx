'use client';

import { useState } from 'react';
import ErrorHighlight from '@/components/ErrorHighlight';
import CorrectionDisplay from '@/components/CorrectionDisplay';
import SimpleCorrectionDisplay from '@/components/SimpleCorrectionDisplay';
import DebugDisplay from '@/components/DebugDisplay';

interface Correction {
  original: string;
  corrected: string;
  type: string;
  explanation?: string;
  startIndex: number;
  endIndex: number;
}

interface CorrectionResponse {
  correctedText: string;
  corrections: Correction[];
  _debug?: {
    logFile: string | null;
    timestamp: string;
  };
}

export default function GrammarTutor() {
  const [text, setText] = useState('');
  const [correctionData, setCorrectionData] = useState<CorrectionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCorrect = async () => {
    if (!text.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/correct-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      setCorrectionData(data);
    } catch (error) {
      console.error('Error correcting text:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (textToCopy: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Grammar Tutor</h1>
          <p className="text-gray-600">Improve your writing with AI-powered grammar corrections</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Enter your text</h2>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste your text here..."
            className="w-full h-40 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleCorrect}
            disabled={!text.trim() || isLoading}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Correcting...' : 'Correct Grammar'}
          </button>
        </div>

        {correctionData && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-700">Results</h2>
              <button
                onClick={() => copyToClipboard(correctionData.correctedText)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Copy Corrected
              </button>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg mb-6">
              <h3 className="font-semibold text-gray-700 mb-3">Original Text with Highlighted Errors:</h3>
              <ErrorHighlight text={text} corrections={correctionData.corrections} showCorrections={true} />
            </div>

            <SimpleCorrectionDisplay
              originalText={text}
              correctedText={correctionData.correctedText}
              corrections={correctionData.corrections}
            />

            {/* Debug Information */}
            {correctionData._debug && (
              <DebugDisplay debugInfo={correctionData._debug} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
