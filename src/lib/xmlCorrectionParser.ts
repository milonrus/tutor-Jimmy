interface Correction {
  original: string;
  corrected: string;
  type: string;
  explanation?: string;
  startIndex: number;
  endIndex: number;
}

interface ParsedXmlResult {
  correctedText: string;
  corrections: Correction[];
  originalText: string;
}

export function parseXmlCorrections(xmlText: string): ParsedXmlResult {
  try {
    // Check if we're in browser or Node.js environment
    let doc: Document;

    if (typeof window !== 'undefined' && window.DOMParser) {
      // Browser environment
      const parser = new DOMParser();
      const wrappedXml = `<root>${xmlText}</root>`;
      doc = parser.parseFromString(wrappedXml, 'text/xml');

      // Check for parsing errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        console.warn('XML parsing failed, falling back to regex parsing');
        return parseXmlWithRegex(xmlText);
      }
    } else {
      // Node.js environment - use regex parsing instead
      return parseXmlWithRegex(xmlText);
    }

    const corrections: Correction[] = [];
    const correctionElements = doc.querySelectorAll('correction');
    let originalText = xmlText;

    // Extract corrections and calculate positions
    Array.from(correctionElements).forEach((element) => {
      const original = element.getAttribute('original') || '';
      const corrected = element.getAttribute('corrected') || '';
      const type = element.getAttribute('type') || 'unknown';
      const explanation = element.getAttribute('explanation') || undefined;
      const textContent = element.textContent || '';

      // Find the position of this correction in the original text
      const correctionXml = element.outerHTML;
      const startIndex = xmlText.indexOf(correctionXml);

      if (startIndex !== -1) {
        corrections.push({
          original,
          corrected,
          type,
          explanation,
          startIndex,
          endIndex: startIndex + correctionXml.length
        });
      }
    });

    // Sort corrections by position
    corrections.sort((a, b) => a.startIndex - b.startIndex);

    // Remove XML tags to get clean original text
    const cleanText = xmlText.replace(/<correction[^>]*>(.*?)<\/correction>/g, '$1');

    // Recalculate positions for clean text
    const adjustedCorrections = recalculatePositions(cleanText, corrections, xmlText);

    return {
      correctedText: cleanText,
      corrections: adjustedCorrections,
      originalText: cleanText
    };

  } catch (error) {
    console.error('Error parsing XML corrections:', error);
    return parseXmlWithRegex(xmlText);
  }
}

function parseXmlWithRegex(xmlText: string): ParsedXmlResult {
  const corrections: Correction[] = [];
  const correctionRegex = /<correction\s+original="([^"]*?)"\s+corrected="([^"]*?)"\s+type="([^"]*?)"(?:\s+explanation="([^"]*?)")?[^>]*>(.*?)<\/correction>/g;

  let match;
  let cleanText = xmlText;
  let offset = 0;

  // Find all correction tags
  while ((match = correctionRegex.exec(xmlText)) !== null) {
    const [fullMatch, original, corrected, type, explanation, textContent] = match;
    const startIndex = match.index - offset;

    corrections.push({
      original,
      corrected,
      type,
      explanation: explanation || undefined,
      startIndex,
      endIndex: startIndex + textContent.length
    });

    // Remove the XML tags from clean text
    cleanText = cleanText.replace(fullMatch, textContent);
    offset += fullMatch.length - textContent.length;
  }

  return {
    correctedText: cleanText,
    corrections,
    originalText: cleanText
  };
}

function recalculatePositions(cleanText: string, corrections: Correction[], xmlText: string): Correction[] {
  return corrections.map(correction => {
    const index = cleanText.indexOf(correction.original);
    return {
      ...correction,
      startIndex: index !== -1 ? index : 0,
      endIndex: index !== -1 ? index + correction.original.length : correction.original.length
    };
  });
}

export function extractCorrectionsFromXml(xmlText: string): Correction[] {
  const result = parseXmlCorrections(xmlText);
  return result.corrections;
}

export function getCleanTextFromXml(xmlText: string): string {
  const result = parseXmlCorrections(xmlText);
  return result.originalText;
}