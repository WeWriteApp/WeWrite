'use client';

import React, { useEffect } from 'react';
import { useLineSettings, LINE_MODES } from '../../contexts/LineSettingsContext';
import EditableContent from './EditableContent';
import ViewableContent from './ViewableContent';

/**
 * ContentDisplay - Unified Content Display System
 * 
 * This is the single entry point for all content display in WeWrite.
 * It handles the decision between editing and viewing modes with clear
 * separation of concerns and consistent styling.
 * 
 * Architecture Principles:
 * 1. Single Responsibility: Only decides between edit/view modes
 * 2. Clear Separation: EditableContent and ViewableContent are completely separate
 * 3. Consistent Styling: All styling decisions are centralized and documented
 * 4. Maintainable: Easy to understand, modify, and extend
 * 
 * Usage:
 * ```tsx
 * <ContentDisplay
 *   content={pageContent}
 *   isEditable={canEdit}
 *   onChange={handleChange}
 *   // ... other props
 * />
 * ```
 */

interface ContentDisplayProps {
  // Content data
  content: any;
  
  // Mode control
  isEditable: boolean;
  
  // Editing props (only used when isEditable=true)
  onChange?: (content: any[]) => void;
  onEmptyLinesChange?: (count: number) => void;
  placeholder?: string;
  
  // Enhanced editing functionality
  location?: { lat: number; lng: number } | null;
  setLocation?: (location: { lat: number; lng: number } | null) => void;
  onSave?: (content?: any) => void;
  onCancel?: () => void;
  onDelete?: (() => void) | null;
  isSaving?: boolean;
  error?: string;
  isNewPage?: boolean;
  showToolbar?: boolean;
  onInsertLinkRequest?: (triggerFn: () => void) => void;
  pageId?: string;
  initialSelectionPath?: import('slate').Path;
  showLinkSuggestions?: boolean;
  onLinkSuggestionCountChange?: (count: number) => void;

  // Link modal state - lifted from Editor to survive remounts during save
  linkModalOpen?: boolean;
  setLinkModalOpen?: (open: boolean) => void;
  linkModalEditingLink?: any;
  setLinkModalEditingLink?: (link: any) => void;
  linkModalSelectedText?: string;
  setLinkModalSelectedText?: (text: string) => void;

  // Viewing props (only used when isEditable=false)
  showDiff?: boolean;
  showLineNumbers?: boolean;
  isSearch?: boolean;
  onRenderComplete?: () => void;
  
  // Common props
  className?: string;
}

/**
 * ContentDisplay Component
 * 
 * The single source of truth for content display decisions.
 * Maintains existing UX while providing clean architecture.
 */
const ContentDisplay: React.FC<ContentDisplayProps> = ({
  content,
  isEditable,
  onChange,
  onEmptyLinesChange,
  placeholder = 'Start writing...',
  location,
  setLocation,
  onSave,
  onCancel,
  onDelete,
  isSaving = false,
  error,
  isNewPage = false,
  showToolbar = false,
  onInsertLinkRequest,
  pageId,
  initialSelectionPath,
  showLinkSuggestions = false,
  onLinkSuggestionCountChange,
  linkModalOpen,
  setLinkModalOpen,
  linkModalEditingLink,
  setLinkModalEditingLink,
  linkModalSelectedText,
  setLinkModalSelectedText,
  showDiff = false,
  showLineNumbers = true,
  isSearch = false,
  onRenderComplete,
  className = ''
}) => {
  // Defensive defaults so logged-out/static views never crash if context is unavailable
  const { lineMode = LINE_MODES.NORMAL, lineFeaturesEnabled = false } = useLineSettings() ?? {};

  // Force normal mode when editing (as per existing behavior)
  const effectiveMode = isEditable
    ? LINE_MODES.NORMAL
    : (lineFeaturesEnabled ? lineMode : LINE_MODES.NORMAL);
  const effectiveShowLineNumbers = showLineNumbers && lineFeaturesEnabled;

  // DEBUG: Track mount/unmount
  useEffect(() => {
    console.log('[ContentDisplay] Component MOUNTED, pageId:', pageId);
    return () => {
      console.log('[ContentDisplay] Component UNMOUNTED, pageId:', pageId);
    };
  }, [pageId]);

  // DEBUG: Log mode changes
  console.log('[ContentDisplay] Rendering with isEditable:', isEditable, 'pageId:', pageId);

  if (isEditable) {
    // EDITING MODE: Use EditableContent component
    return (
      <EditableContent
        content={content}
        onChange={onChange!}
        onEmptyLinesChange={onEmptyLinesChange}
        placeholder={placeholder}
        location={location}
        setLocation={setLocation}
        onSave={onSave}
        onCancel={onCancel}
        onDelete={onDelete}
        isSaving={isSaving}
        error={error}
        isNewPage={isNewPage}
        showToolbar={showToolbar}
        onInsertLinkRequest={onInsertLinkRequest}
        pageId={pageId}
        initialSelectionPath={initialSelectionPath}
        showLinkSuggestions={showLinkSuggestions}
        onLinkSuggestionCountChange={onLinkSuggestionCountChange}
        linkModalOpen={linkModalOpen}
        setLinkModalOpen={setLinkModalOpen}
        linkModalEditingLink={linkModalEditingLink}
        setLinkModalEditingLink={setLinkModalEditingLink}
        linkModalSelectedText={linkModalSelectedText}
        setLinkModalSelectedText={setLinkModalSelectedText}
        className={className}
      />
    );
  } else {
    // VIEWING MODE: Use ViewableContent component
    return (
      <ViewableContent
        content={content}
        showDiff={showDiff}
        showLineNumbers={effectiveShowLineNumbers}
        isSearch={isSearch}
        onRenderComplete={onRenderComplete}
        lineMode={effectiveMode}
        className={className}
      />
    );
  }
};

export default ContentDisplay;
