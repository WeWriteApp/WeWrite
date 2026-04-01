import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface UseChangeDetectionOptions {
  editorState: any;
  title: string;
  location: any;
  customDate: string | null;
  page: any;
  justSaved: boolean;
  isSaving: boolean;
  pageId: string;
}

/**
 * Tracks whether content has changed since the last save.
 * Owns the "last saved" baseline refs and the hasChanges computation.
 */
export function useChangeDetection({
  editorState,
  title,
  location,
  customDate,
  page,
  justSaved,
  isSaving,
  pageId,
}: UseChangeDetectionOptions) {
  // Refs to track last saved state for change detection
  const lastSavedContentRef = useRef<any>(null);
  const lastSavedTitleRef = useRef<string>('');
  const lastSavedLocationRef = useRef<any>(null);
  const lastSavedCustomDateRef = useRef<string | null>(null);

  // Track whether refs have been initialized (prevents false positives on initial load)
  // This MUST be state (not ref) so that changes trigger re-render and useMemo recomputes
  const [refsInitialized, setRefsInitialized] = useState(false);

  // Initialize saved refs when page first loads - this MUST happen synchronously with content loading
  // The key fix: we track initialization state separately from content
  useEffect(() => {
    // Only initialize refs once per page load, and only when we have valid page data
    if (page && !refsInitialized && !isSaving) {
      // CRITICAL: Parse content the same way as editorState to ensure accurate comparison
      // page.content might be a JSON string, but editorState is always a parsed object
      let parsedContent = page.content;
      if (typeof page.content === 'string') {
        try {
          parsedContent = JSON.parse(page.content);
        } catch {
          // If parsing fails, use as-is
          parsedContent = page.content;
        }
      }
      lastSavedContentRef.current = parsedContent;
      lastSavedTitleRef.current = page.title || '';
      lastSavedLocationRef.current = page.location || null;
      lastSavedCustomDateRef.current = page.customDate || null;
      setRefsInitialized(true);
    }
  }, [page, isSaving, refsInitialized]);

  // Reset refs when page ID changes (navigating to a different page)
  useEffect(() => {
    setRefsInitialized(false);
  }, [pageId]);

  // Compute if content differs from last saved state
  // SIMPLIFIED: No fallbacks to hasUnsavedChanges - pure comparison only
  const hasChanges = useMemo(() => {
    // Don't show changes until refs are initialized (prevents flash on load)
    if (!refsInitialized) {
      return false;
    }

    // CRITICAL: Skip hasChanges check right after save to prevent false positives
    // The justSaved flag is set after save and cleared after 2 seconds
    // This prevents the "unsaved changes" warning immediately after saving
    if (justSaved) {
      return false;
    }

    // For new pages, check if any content has been added
    if (page?.isNewPage) {
      // New page has changes if content exists and isn't just empty paragraph
      if (!editorState || !Array.isArray(editorState)) return false;
      if (editorState.length === 0) return false;
      if (editorState.length === 1) {
        const firstBlock = editorState[0];
        if (firstBlock?.type === 'paragraph' && firstBlock?.children) {
          const text = firstBlock.children.map((c: any) => c.text || '').join('');
          return text.trim().length > 0;
        }
      }
      return true;
    }

    // Compare title against saved ref
    const savedTitle = lastSavedTitleRef.current;
    if (savedTitle !== '' && title !== savedTitle) {
      return true;
    }

    // Compare location
    const savedLocation = lastSavedLocationRef.current;
    if (JSON.stringify(location) !== JSON.stringify(savedLocation)) {
      return true;
    }

    // Compare custom date
    const savedCustomDate = lastSavedCustomDateRef.current;
    if (customDate !== savedCustomDate) {
      return true;
    }

    // Compare content - expensive check, do last
    const savedContent = lastSavedContentRef.current;
    // Both null/undefined = no changes
    if (!savedContent && !editorState) return false;
    // One exists, other doesn't = changes (but wait for both to be loaded)
    if (!savedContent || !editorState) return false;

    try {
      const savedStr = JSON.stringify(savedContent);
      const currentStr = JSON.stringify(editorState);
      return savedStr !== currentStr;
    } catch {
      // Serialization failed - assume no changes to avoid false positives
      return false;
    }
  }, [title, location, customDate, editorState, page?.isNewPage, refsInitialized, justSaved]);

  // Function to update saved baselines (called after successful save)
  const updateSavedBaseline = useCallback((saved: {
    content: any;
    title: string;
    location: any;
    customDate: string | null;
  }) => {
    lastSavedContentRef.current = saved.content;
    lastSavedTitleRef.current = saved.title;
    lastSavedLocationRef.current = saved.location;
    lastSavedCustomDateRef.current = saved.customDate;
  }, []);

  return {
    hasChanges,
    refsInitialized,
    lastSavedContentRef,
    lastSavedTitleRef,
    lastSavedLocationRef,
    lastSavedCustomDateRef,
    updateSavedBaseline,
  };
}
