import React from 'react';
import { Text, useStdout } from 'ink';
import { calculateOutputWindowContentWidth } from './heightCalculations';
import { parseMarker } from '../../shared/formatters/outputMarkers.js';

export interface LineSyntaxHighlightProps {
  line: string;
  maxWidth?: number;
  wrap?: boolean;
}

/**
 * Apply consistent syntax highlighting to workflow output/log lines.
 * Supports text wrapping and truncation to prevent container width overflow.
 */
export const LineSyntaxHighlight: React.FC<LineSyntaxHighlightProps> = ({
  line,
  maxWidth,
  wrap: _wrap = true
}) => {
  const { stdout } = useStdout();

  // Calculate available width if not provided
  const _availableWidth = maxWidth || calculateOutputWindowContentWidth(stdout);

  // Parse color marker and get text without marker
  const { color: markerColor, text } = parseMarker(line);

  // Determine text color based on marker or content
  const getTextColor = (parsedColor: string | null, text: string): string | undefined => {
    // If there's a color marker, use it
    if (parsedColor) {
      // Use hex colors for extended palette
      if (parsedColor === 'orange') return '#FF8C00';
      if (parsedColor === 'yellow') return 'yellow';
      if (parsedColor === 'blue') return 'blue';
      if (parsedColor === 'magenta') return 'magenta';
      return parsedColor;
    }

    // Fallback to legacy detection for backwards compatibility
    if (text.includes('⏱️') || text.includes('Tokens:')) return 'yellow';
    if (text.includes('ERROR') || text.includes('✗') || text.includes('Error:')) return 'red';
    return undefined;
  };

  const getBold = (text: string) => {
    return text.startsWith('===');
  };

  // Strip bold markers (===) from text if present
  const stripBoldMarker = (text: string) => {
    if (text.startsWith('===')) {
      return text.substring(3);
    }
    return text;
  };

  // Apply syntax highlighting
  const color = getTextColor(markerColor, text);
  const bold = getBold(text);
  const displayText = stripBoldMarker(text);

  return <Text color={color} bold={bold}>{displayText}</Text>;
};
