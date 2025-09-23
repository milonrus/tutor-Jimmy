'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { formatCost, formatTokens } from '@/lib/costCalculator';

interface Correction {
  original: string;
  corrected: string;
  type: string;
  explanation?: string;
  startIndex: number;
  endIndex: number;
}

interface HistoryItem {
  id: string;
  originalText: string;
  correctedText: string;
  corrections: Correction[];
  model: string;
  timestamp: Timestamp;
  createdAt: Timestamp;
  // Token usage and cost fields
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  inputCostUSD?: number;
  outputCostUSD?: number;
  totalCostUSD?: number;
}

interface CorrectionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CorrectionHistory({ isOpen, onClose }: CorrectionHistoryProps) {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  const fetchHistory = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const q = query(
        collection(db, 'corrections'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const querySnapshot = await getDocs(q);
      const historyData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HistoryItem[];

      console.log('Fetched history:', {
        userId: user.uid,
        totalDocs: querySnapshot.docs.length,
        historyData: historyData
      });

      setHistory(historyData);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return 'Unknown date';
    return timestamp.toDate().toLocaleString();
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Calculate statistics from history
  const calculateStats = () => {
    const totalCost = history.reduce((sum, item) => sum + (item.totalCostUSD || 0), 0);
    const totalTokens = history.reduce((sum, item) => sum + (item.totalTokens || 0), 0);
    const totalCorrections = history.reduce((sum, item) => sum + item.corrections.length, 0);
    const averageCostPerCorrection = totalCorrections > 0 ? totalCost / history.length : 0;

    return {
      totalCost,
      totalTokens,
      totalCorrections,
      totalRequests: history.length,
      averageCostPerCorrection
    };
  };

  const stats = calculateStats();

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
      setSelectedItem(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] mx-4 overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Correction History</h2>
          <button
            onClick={() => {
              onClose();
              setSelectedItem(null);
            }}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>

        {/* Statistics Summary */}
        {!loading && !selectedItem && history.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg mb-4 border">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">📊 Usage Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="font-bold text-blue-600">{stats.totalRequests}</div>
                <div className="text-gray-600 text-xs">Total Requests</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-green-600">{formatTokens(stats.totalTokens)}</div>
                <div className="text-gray-600 text-xs">Total Tokens</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-purple-600">{stats.totalCorrections}</div>
                <div className="text-gray-600 text-xs">Total Corrections</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-orange-600">{formatCost(stats.totalCost)}</div>
                <div className="text-gray-600 text-xs">Total Cost</div>
              </div>
            </div>
            {stats.averageCostPerCorrection > 0 && (
              <div className="mt-3 text-center text-xs text-gray-600">
                Average cost per request: {formatCost(stats.averageCostPerCorrection)}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
            <span className="ml-2 text-gray-600">Loading history...</span>
          </div>
        ) : selectedItem ? (
          <div className="flex-1 overflow-y-auto">
            <button
              onClick={() => setSelectedItem(null)}
              className="mb-4 text-blue-600 hover:text-blue-700 flex items-center"
            >
              ← Back to history
            </button>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2">Details</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>Date:</strong> {formatDate(selectedItem.timestamp)}</p>
                  <p><strong>Model:</strong> {selectedItem.model}</p>
                  <p><strong>Corrections found:</strong> {selectedItem.corrections.length}</p>
                  {selectedItem.totalTokens && (
                    <p><strong>Tokens used:</strong> {formatTokens(selectedItem.totalTokens)}</p>
                  )}
                  {selectedItem.totalCostUSD !== undefined && (
                    <p><strong>Cost:</strong> {formatCost(selectedItem.totalCostUSD)}</p>
                  )}
                </div>
              </div>

              {/* Token and Cost Breakdown */}
              {(selectedItem.inputTokens || selectedItem.outputTokens || selectedItem.totalCostUSD !== undefined) && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-2">Usage & Cost Breakdown</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium text-gray-600 mb-1">Token Usage</h4>
                      {selectedItem.inputTokens !== undefined && (
                        <p className="text-gray-600">Input: {formatTokens(selectedItem.inputTokens)}</p>
                      )}
                      {selectedItem.outputTokens !== undefined && (
                        <p className="text-gray-600">Output: {formatTokens(selectedItem.outputTokens)}</p>
                      )}
                      {selectedItem.totalTokens !== undefined && (
                        <p className="text-gray-800 font-medium">Total: {formatTokens(selectedItem.totalTokens)}</p>
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-600 mb-1">Cost Breakdown</h4>
                      {selectedItem.inputCostUSD !== undefined && (
                        <p className="text-gray-600">Input: {formatCost(selectedItem.inputCostUSD)}</p>
                      )}
                      {selectedItem.outputCostUSD !== undefined && (
                        <p className="text-gray-600">Output: {formatCost(selectedItem.outputCostUSD)}</p>
                      )}
                      {selectedItem.totalCostUSD !== undefined && (
                        <p className="text-gray-800 font-medium">Total: {formatCost(selectedItem.totalCostUSD)}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2">Original Text</h3>
                <p className="text-gray-800 whitespace-pre-wrap">{selectedItem.originalText}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2">Corrected Text</h3>
                <div
                  className="text-gray-800 prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedItem.correctedText }}
                />
              </div>

              {selectedItem.corrections.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-2">Corrections Summary</h3>
                  <div className="space-y-2">
                    {selectedItem.corrections.map((correction, index) => (
                      <div key={index} className="bg-white p-3 rounded border">
                        <div className="text-sm">
                          <span className="text-red-600 line-through">{correction.original}</span>
                          {' → '}
                          <span className="text-green-600">{correction.corrected}</span>
                        </div>
                        {correction.explanation && (
                          <p className="text-xs text-gray-600 mt-1">{correction.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No correction history found.</p>
                <p className="text-sm mt-2">Start correcting text to see your history here!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="bg-gray-50 p-4 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm text-gray-600">
                        {formatDate(item.timestamp)}
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {item.model}
                      </span>
                    </div>

                    <p className="text-gray-800 mb-2 line-clamp-2">
                      {truncateText(item.originalText)}
                    </p>

                    <div className="flex justify-between items-center text-sm text-gray-600">
                      <div className="flex flex-col space-y-1">
                        <span>{item.corrections.length} corrections found</span>
                        {item.totalTokens && (
                          <span className="text-xs">{formatTokens(item.totalTokens)} tokens</span>
                        )}
                      </div>
                      <div className="flex flex-col items-end space-y-1">
                        {item.totalCostUSD !== undefined && (
                          <span className="text-xs font-medium text-green-600">{formatCost(item.totalCostUSD)}</span>
                        )}
                        <span className="text-blue-600">View details →</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}