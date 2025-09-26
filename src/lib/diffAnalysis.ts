import * as Diff from 'diff';

interface Correction {
  original: string;
  corrected: string;
  type: string;
  explanation?: string;
  startIndex: number;
  endIndex: number;
}

interface DiffAnalysisResult {
  corrections: Correction[];
  originalText: string;
}

/**
 * Analyzes the differences between original and corrected text
 * and converts them into the Correction interface format used by the UI
 */
export function analyzeDifferences(originalText: string, correctedText: string): DiffAnalysisResult {
  // If texts are identical, return no corrections
  if (originalText === correctedText) {
    return {
      corrections: [],
      originalText
    };
  }
  // Use word-level diffing for better granularity
  const diff = Diff.diffWords(originalText, correctedText);

  const corrections: Correction[] = [];
  let currentIndex = 0;
  let correctionIndex = 0;

  // Process each diff part
  for (let i = 0; i < diff.length; i++) {
    const part = diff[i];
    const nextPart = diff[i + 1];

    if (part.removed && nextPart?.added) {
      // This is a replacement (deletion followed by addition)
      const original = part.value;
      const corrected = nextPart.value;

      corrections.push({
        original,
        corrected,
        type: determineErrorType(original, corrected),
        explanation: 'Missing explanation', // Placeholder as requested
        startIndex: currentIndex,
        endIndex: currentIndex + original.length
      });

      currentIndex += original.length;
      i++; // Skip the next part since we processed it
      correctionIndex++;
    } else if (part.removed) {
      // This is a deletion (text was removed)
      const original = part.value;

      corrections.push({
        original,
        corrected: '', // Empty string means deletion
        type: 'deletion',
        explanation: 'Missing explanation',
        startIndex: currentIndex,
        endIndex: currentIndex + original.length
      });

      currentIndex += original.length;
      correctionIndex++;
    } else if (part.added) {
      // This is an insertion (text was added)
      // We need to handle this as an insertion at the current position
      corrections.push({
        original: '', // Empty string means insertion
        corrected: part.value,
        type: 'insertion',
        explanation: 'Missing explanation',
        startIndex: currentIndex,
        endIndex: currentIndex
      });
      // Don't increment currentIndex for insertions in original text
      correctionIndex++;
    } else {
      // Unchanged text - just move the index forward
      currentIndex += part.value.length;
    }
  }

  return {
    corrections,
    originalText
  };
}

/**
 * Determines the type of error based on the original and corrected text
 */
function determineErrorType(original: string, corrected: string): string {
  // Simple heuristics to determine error type
  const originalLower = original.toLowerCase();
  const correctedLower = corrected.toLowerCase();

  // Check for punctuation changes
  if (/[.,;:!?]/.test(original) || /[.,;:!?]/.test(corrected)) {
    return 'punctuation';
  }

  // Check for capitalization changes
  if (originalLower === correctedLower) {
    return 'capitalization';
  }

  // Check for spelling (similar words)
  if (areWordsSimilar(originalLower, correctedLower)) {
    return 'spelling';
  }

  // Check for grammar patterns
  if (isGrammarChange(original, corrected)) {
    return 'grammar';
  }

  // Default to word choice for other changes
  return 'word choice';
}

/**
 * Checks if two words are similar (likely spelling correction)
 */
function areWordsSimilar(word1: string, word2: string): boolean {
  // Simple check for similar length and some common characters
  if (Math.abs(word1.length - word2.length) <= 2) {
    let commonChars = 0;
    const minLength = Math.min(word1.length, word2.length);

    for (let i = 0; i < minLength; i++) {
      if (word1[i] === word2[i]) {
        commonChars++;
      }
    }

    return commonChars / minLength > 0.6;
  }

  return false;
}

/**
 * Checks if the change appears to be a grammar correction
 */
function isGrammarChange(original: string, corrected: string): boolean {
  const grammarPatterns = [
    // Common grammar patterns
    /\b(is|are|was|were|am)\b/i,
    /\b(a|an|the)\b/i,
    /\b(he|she|it|they|we|you|I)\b/i,
    /\b(has|have|had)\b/i,
    /\b(do|does|did)\b/i,
  ];

  return grammarPatterns.some(pattern =>
    pattern.test(original) || pattern.test(corrected)
  );
}

/**
 * Simple word-level diff that's more suitable for grammar corrections
 * This version tries to maintain word boundaries better than character-level diff
 */
export function simpleWordDiff(originalText: string, correctedText: string): DiffAnalysisResult {
  // Split into words but preserve whitespace information
  const originalWords = originalText.split(/(\s+)/);
  const correctedWords = correctedText.split(/(\s+)/);

  const corrections: Correction[] = [];
  let originalIndex = 0;
  let correctedIndex = 0;
  let charPosition = 0;

  while (originalIndex < originalWords.length || correctedIndex < correctedWords.length) {
    const originalWord = originalWords[originalIndex];
    const correctedWord = correctedWords[correctedIndex];

    if (originalWord === correctedWord) {
      // Words match, move both pointers forward
      if (originalWord) {
        charPosition += originalWord.length;
      }
      originalIndex++;
      correctedIndex++;
    } else {
      // Words don't match, we have a change
      const startPos = charPosition;
      let original = originalWord || '';
      let corrected = correctedWord || '';

      // Handle multiple word changes by looking ahead
      let lookahead = 1;
      while (
        originalIndex + lookahead < originalWords.length &&
        correctedIndex + lookahead < correctedWords.length &&
        originalWords[originalIndex + lookahead] !== correctedWords[correctedIndex + lookahead]
      ) {
        if (originalWords[originalIndex + lookahead]) {
          original += originalWords[originalIndex + lookahead];
        }
        if (correctedWords[correctedIndex + lookahead]) {
          corrected += correctedWords[correctedIndex + lookahead];
        }
        lookahead++;
      }

      if (original || corrected) {
        corrections.push({
          original,
          corrected,
          type: determineErrorType(original, corrected),
          explanation: 'Missing explanation',
          startIndex: startPos,
          endIndex: startPos + original.length
        });
      }

      charPosition += original.length;
      originalIndex += lookahead;
      correctedIndex += lookahead;
    }
  }

  return {
    corrections,
    originalText
  };
}