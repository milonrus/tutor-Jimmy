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

interface ErrorHighlightProps {
  text: string;
  corrections: Correction[];
  showCorrections?: boolean;
}

export default function ErrorHighlight({ text, corrections, showCorrections = false }: ErrorHighlightProps) {
  const [hoveredCorrection, setHoveredCorrection] = useState<Correction | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (correction: Correction, event: React.MouseEvent) => {
    if (correction.explanation) {
      setHoveredCorrection(correction);
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseLeave = () => {
    setHoveredCorrection(null);
  };

  const renderTextWithHighlights = () => {
    if (corrections.length === 0) {
      return <span className="text-gray-800">{text}</span>;
    }

    // Sort corrections by start index to process them in order
    const sortedCorrections = [...corrections].sort((a, b) => a.startIndex - b.startIndex);

    const segments = [];
    let remainingText = text;
    let processedLength = 0;

    sortedCorrections.forEach((correction, index) => {
      // Find the position of the original text in the remaining text
      const originalText = correction.original;
      const expectedPosition = correction.startIndex - processedLength;

      // Verify that the correction matches what we expect at this position
      const actualTextAtPosition = remainingText.slice(expectedPosition, expectedPosition + originalText.length);

      if (actualTextAtPosition === originalText) {
        // Add text before the error
        if (expectedPosition > 0) {
          segments.push(
            <span key={`text-${index}`} className="text-gray-800">
              {remainingText.slice(0, expectedPosition)}
            </span>
          );
        }

        // Add the highlighted error with optional correction
        if (showCorrections) {
          segments.push(
            <span key={`correction-${index}`} className="inline">
              <span
                className="line-through bg-red-200 text-red-800 cursor-pointer relative"
                onMouseEnter={(e) => handleMouseEnter(correction, e)}
                onMouseLeave={handleMouseLeave}
              >
                {originalText}
              </span>
              <span className="bg-green-200 text-green-800 font-medium ml-1 px-1 rounded">
                {correction.corrected}
              </span>
            </span>
          );
        } else {
          segments.push(
            <span
              key={`error-${index}`}
              className="bg-red-200 text-red-800 border-b-2 border-red-400 cursor-pointer relative"
              onMouseEnter={(e) => handleMouseEnter(correction, e)}
              onMouseLeave={handleMouseLeave}
            >
              {originalText}
            </span>
          );
        }

        // Update remaining text and processed length
        remainingText = remainingText.slice(expectedPosition + originalText.length);
        processedLength += expectedPosition + originalText.length;
      } else {
        // If the text doesn't match, try to find it in the remaining text
        const foundIndex = remainingText.indexOf(originalText);
        if (foundIndex !== -1) {
          // Add text before the found error
          if (foundIndex > 0) {
            segments.push(
              <span key={`text-${index}`} className="text-gray-800">
                {remainingText.slice(0, foundIndex)}
              </span>
            );
          }

          // Add the highlighted error with optional correction
          if (showCorrections) {
            segments.push(
              <span key={`correction-${index}`} className="inline">
                <span
                  className="line-through bg-red-200 text-red-800 cursor-pointer relative"
                  onMouseEnter={(e) => handleMouseEnter(correction, e)}
                  onMouseLeave={handleMouseLeave}
                >
                  {originalText}
                </span>
                <span className="bg-green-200 text-green-800 font-medium ml-1 px-1 rounded">
                  {correction.corrected}
                </span>
              </span>
            );
          } else {
            segments.push(
              <span
                key={`error-${index}`}
                className="bg-red-200 text-red-800 border-b-2 border-red-400 cursor-pointer relative"
                onMouseEnter={(e) => handleMouseEnter(correction, e)}
                onMouseLeave={handleMouseLeave}
              >
                {originalText}
              </span>
            );
          }

          // Update remaining text and processed length
          remainingText = remainingText.slice(foundIndex + originalText.length);
          processedLength += foundIndex + originalText.length;
        } else {
          // If we can't find the text, log an error and skip this correction
          console.warn('Could not find correction text:', originalText, 'in remaining text:', remainingText.slice(0, 50) + '...');
        }
      }
    });

    // Add remaining text after the last error
    if (remainingText.length > 0) {
      segments.push(
        <span key="text-end" className="text-gray-800">
          {remainingText}
        </span>
      );
    }

    return segments;
  };

  return (
    <div className="relative">
      <div className="leading-relaxed">
        {renderTextWithHighlights()}
      </div>

      {hoveredCorrection && hoveredCorrection.explanation && (
        <div
          className="fixed z-50 bg-gray-900 text-white p-3 rounded-lg shadow-lg max-w-xs text-sm"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 50,
          }}
        >
          <div className="font-semibold text-red-300 mb-1">
            {hoveredCorrection.type.charAt(0).toUpperCase() + hoveredCorrection.type.slice(1)} Error
          </div>
          <div className="mb-2">
            <span className="line-through text-red-300">{hoveredCorrection.original}</span>
            {' → '}
            <span className="text-green-300">{hoveredCorrection.corrected}</span>
          </div>
          <div className="text-gray-300">
            {hoveredCorrection.explanation}
          </div>
        </div>
      )}
    </div>
  );
}