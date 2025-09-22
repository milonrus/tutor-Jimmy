'use client';

interface Correction {
  original: string;
  corrected: string;
  type: string;
  explanation?: string;
  startIndex: number;
  endIndex: number;
}

interface SimpleCorrectionDisplayProps {
  originalText: string;
  correctedText: string;
  corrections: Correction[];
}

export default function SimpleCorrectionDisplay({ originalText, correctedText, corrections }: SimpleCorrectionDisplayProps) {
  const renderSimpleCorrections = () => {
    if (corrections.length === 0) {
      return (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-700 mb-3">Corrected Text:</h3>
            <div className="leading-relaxed">{correctedText}</div>
          </div>
          <div className="text-gray-500 italic">No corrections needed!</div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Show corrected text */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Corrected Text:</h3>
          <div className="leading-relaxed">{correctedText}</div>
        </div>

        {/* Show individual corrections */}
        <div>
          <h3 className="font-semibold text-gray-700 mb-4">
            {corrections.length} correction{corrections.length > 1 ? 's' : ''} made:
          </h3>
          <div className="space-y-3">
            {corrections.map((correction, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-1 text-xs rounded font-medium ${
                    correction.type === 'spelling' ? 'bg-red-100 text-red-800' :
                    correction.type === 'grammar' ? 'bg-blue-100 text-blue-800' :
                    correction.type === 'punctuation' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {correction.type.charAt(0).toUpperCase() + correction.type.slice(1)}
                  </span>
                </div>

                <div className="mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Original:</span>
                    <span className="line-through text-red-600 bg-red-50 px-2 py-1 rounded">
                      {correction.original}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm mt-1">
                    <span className="text-gray-500">Corrected:</span>
                    <span className="text-green-600 bg-green-50 px-2 py-1 rounded font-medium">
                      {correction.corrected}
                    </span>
                  </div>
                </div>

                {correction.explanation && (
                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded border-l-4 border-blue-200">
                    <span className="font-medium">Explanation:</span> {correction.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return renderSimpleCorrections();
}