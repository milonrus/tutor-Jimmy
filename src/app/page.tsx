'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ErrorHighlight from '@/components/ErrorHighlight';
import DebugDisplay from '@/components/DebugDisplay';
import ModelSelector from '@/components/ModelSelector';
import { DEFAULT_MODEL, OPENAI_MODELS, ReasoningEffort } from '@/config/openai-models';

interface Correction {
  original: string;
  corrected: string;
  type: string;
  explanation?: string;
  startIndex: number;
  endIndex: number;
}

interface CorrectionResponse {
  corrections: Correction[];
  originalText: string;
  xmlText: string;
  debug?: {
    model: string;
    usage: unknown;
    xmlResponse: string;
    parsedCorrections: number;
  };
}


interface StatusUpdate {
  step: number;
  totalSteps: number;
  message: string;
  details?: string;
}

interface StatusLogEntry {
  timestamp: number; // milliseconds since start
  absoluteTime: Date;
  step: number;
  totalSteps: number;
  message: string;
  details?: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export default function GrammarTutor() {
  const [text, setText] = useState('');
  const [correctionData, setCorrectionData] = useState<CorrectionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [statusLogs, setStatusLogs] = useState<StatusLogEntry[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(8);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>('low');
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const startTimeRef = useRef<number>(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Log management functions
  const addStatusLog = useCallback((update: StatusUpdate, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const now = Date.now();
    const timestamp = startTimeRef.current > 0 ? now - startTimeRef.current : 0;

    const logEntry: StatusLogEntry = {
      timestamp,
      absoluteTime: new Date(),
      step: update.step,
      totalSteps: update.totalSteps,
      message: update.message,
      details: update.details,
      type
    };

    setStatusLogs(prev => [...prev, logEntry]);
    setCurrentStep(update.step);
    setTotalSteps(update.totalSteps);

    // Auto-scroll to latest log
    setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    }, 100);
  }, []);

  const clearStatusLogs = () => {
    setStatusLogs([]);
    setCurrentStep(0);
    setTotalSteps(8);
    startTimeRef.current = 0;
  };

  const formatTimestamp = (timestamp: number) => {
    const seconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isLoading) {
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isLoading]);

  const handleCorrect = useCallback(async () => {
    if (!text.trim()) return;

    setIsLoading(true);
    setElapsedTime(0);
    clearStatusLogs();
    startTimeRef.current = Date.now();
    addStatusLog({ step: 1, totalSteps: 3, message: 'Sending request...', details: 'Sending text to grammar correction API' }, 'info');

    try {
      addStatusLog({ step: 2, totalSteps: 3, message: 'Processing...', details: 'AI is analyzing your text for grammar errors' }, 'info');

      const supportsReasoning = Boolean(OPENAI_MODELS[selectedModel]?.supportsReasoning);
      const response = await fetch('/api/correct-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model: selectedModel,
          reasoningEffort: supportsReasoning ? reasoningEffort : undefined
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: CorrectionResponse = await response.json();
      setCorrectionData(data);

      addStatusLog({ step: 3, totalSteps: 3, message: 'Complete!', details: `Found ${data.corrections.length} corrections` }, 'success');

    } catch (error) {
      console.error('Error correcting text:', error);
      addStatusLog({ step: 0, totalSteps: 3, message: 'Error', details: error instanceof Error ? error.message : 'Unknown error occurred' }, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [text, selectedModel, reasoningEffort, addStatusLog]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (text.trim() && !isLoading) {
          handleCorrect();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [text, isLoading, handleCorrect]);

  const handleCancel = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
    addStatusLog({ step: 0, totalSteps: 8, message: 'Cancelled', details: 'Request was cancelled by user' }, 'warning');
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-4">
            <div className="lg:col-span-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or paste your text here..."
                className="w-full h-40 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="lg:col-span-1">
              <ModelSelector
                selectedModel={selectedModel}
                onModelChange={(modelId) => {
                  setSelectedModel(modelId);
                  if (!OPENAI_MODELS[modelId]?.supportsReasoning) {
                    setReasoningEffort('medium');
                  }
                }}
                reasoningEffort={reasoningEffort}
                onReasoningChange={setReasoningEffort}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <button
                onClick={handleCorrect}
                disabled={!text.trim() || isLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                )}
                {isLoading ? 'Processing...' : 'Correct Grammar'}
              </button>

              {isLoading && (
                <>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <div className="text-gray-600 text-sm font-mono">
                    {elapsedTime}s
                  </div>
                </>
              )}
            </div>

            {(isLoading || statusLogs.length > 0) && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                {/* Overall Progress Bar */}
                {isLoading && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-700 font-medium text-sm">
                        Overall Progress
                      </span>
                      <span className="text-gray-600 text-xs font-mono">
                        Step {currentStep} of {totalSteps} ({Math.round((currentStep / totalSteps) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-300 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Status Logs */}
                <div
                  ref={logContainerRef}
                  className="space-y-1 max-h-64 overflow-y-auto bg-white rounded border p-3 font-mono text-xs"
                >
                  {statusLogs.map((log, index) => {
                    const getLogColors = (type: string) => {
                      switch (type) {
                        case 'success':
                          return 'text-green-700 border-green-200';
                        case 'error':
                          return 'text-red-700 border-red-200';
                        case 'warning':
                          return 'text-yellow-700 border-yellow-200';
                        default:
                          return 'text-blue-700 border-blue-200';
                      }
                    };

                    return (
                      <div
                        key={index}
                        className={`flex items-start gap-2 p-2 rounded border-l-2 bg-gray-50 ${getLogColors(log.type)} transition-all duration-300 ease-in-out`}
                      >
                        <span className="text-gray-500 font-mono text-xs whitespace-nowrap">
                          [{formatTimestamp(log.timestamp)}]
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">
                            {log.message}
                          </div>
                          {log.details && (
                            <div className="text-gray-600 mt-1">
                              {log.details}
                            </div>
                          )}
                        </div>
                        {log.type === 'info' && isLoading && index === statusLogs.length - 1 && (
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent flex-shrink-0"></div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Info */}
                {isLoading && (
                  <div className="mt-3 text-gray-600 text-xs text-center">
                    Model: {selectedModel} • {elapsedTime}s elapsed
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {correctionData && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-700">Error Analysis</h2>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg mb-6">
              <h3 className="font-semibold text-gray-700 mb-3">Text with Highlighted Errors:</h3>
              <ErrorHighlight text={correctionData.originalText || text} corrections={correctionData.corrections || []} showCorrections={true} />
            </div>

            {/* Debug Information */}
            {correctionData.debug && (
              <DebugDisplay debugInfo={correctionData.debug} xmlText={correctionData.xmlText} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
