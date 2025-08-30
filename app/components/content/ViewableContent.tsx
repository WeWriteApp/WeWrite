'use client';

import React from 'react';
import TextView from '../editor/TextView';
import { LINE_MODES } from '../../contexts/LineSettingsContext';

/**
 * ViewableContent - Pure Viewing Component
 *
 * This component handles all viewing functionality for WeWrite content.
 * It provides a clean, distraction-free reading experience with support
 * for dense mode and other viewing features.
 *
 * CONSOLIDATED: Now uses TextView with canEdit=false instead of duplicate ContentViewer
 *
 * Responsibilities:
 * - Clean content viewing
 * - Dense/normal mode support
 * - Line numbers and navigation
 * - Diff viewing
 * - Search result highlighting
 * - Link navigation (no editing)
 *
 * Styling Philosophy:
 * - No borders (clean viewing experience)
 * - Transparent background
 * - Proper text color inheritance
 * - Responsive design
 * - Focus on readability
 */

interface ViewableContentProps {
  content: any;
  showDiff?: boolean;
  showLineNumbers?: boolean;
  isSearch?: boolean;
  onRenderComplete?: () => void;
  lineMode?: string;
  className?: string;
}

/**
 * ViewableContent Component
 * 
 * Provides a clean viewing experience with consistent styling.
 * All styling decisions are documented and centralized.
 */
const ViewableContent: React.FC<ViewableContentProps> = ({
  content,
  showDiff = false,
  showLineNumbers = true,
  isSearch = false,
  onRenderComplete,
  lineMode = LINE_MODES.NORMAL,
  className = ''
}) => {
  return (
    <div className={`wewrite-viewable-content ${className}`}>
      <TextView
        content={content}
        showDiff={showDiff}
        showLineNumbers={showLineNumbers}
        isSearch={isSearch}
        onRenderComplete={onRenderComplete}
        canEdit={false} // VIEWING ONLY - no editing capabilities
        viewMode="normal"
        isEditing={false}
      />
    </div>
  );
};

export default ViewableContent;
