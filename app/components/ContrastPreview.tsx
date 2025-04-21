"use client";

import * as React from "react";
import { getBestTextColor, meetsContrastStandards } from "../utils/accessibility";

interface ContrastPreviewProps {
  backgroundColor: string;
  className?: string;
}

/**
 * ContrastPreview Component
 *
 * A utility component that shows a preview of text with proper contrast
 * against a given background color.
 */
export function ContrastPreview({ backgroundColor, className = "" }: ContrastPreviewProps) {
  const textColor = getBestTextColor(backgroundColor, {
    level: 'AA',
    size: 'normal',
    preferredColors: ['#ffffff', '#000000']
  });

  // Check if the contrast meets AA standards for the tooltip
  const meetsAA = meetsContrastStandards(textColor, backgroundColor, 'AA', 'normal');
  const meetsAAA = meetsContrastStandards(textColor, backgroundColor, 'AAA', 'normal');

  return (
    <div
      className={`px-2 py-1 rounded text-xs font-medium ${className}`}
      style={{
        backgroundColor,
        color: textColor,
        border: '1px solid rgba(0,0,0,0.1)'
      }}
      title={`Contrast: ${meetsAAA ? 'AAA' : (meetsAA ? 'AA' : 'Fails')} compliance`}
    >
      Aa
    </div>
  );
}

export default ContrastPreview;
