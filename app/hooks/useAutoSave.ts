import { useState, useEffect, useRef } from 'react';

interface UseAutoSaveOptions {
  editorState: any;
  title: string;
  location: any;
  canEdit: any;
  isSaving: boolean;
  isNewPage: boolean | undefined;
  pageId: string;
  hasPageTitle: boolean;
  onSave: (content?: any, options?: { isAutoSave?: boolean; sessionId?: string | null }) => Promise<void>;
  lastSavedContentRef: React.MutableRefObject<any>;
  lastSavedTitleRef: React.MutableRefObject<string>;
  lastSavedLocationRef: React.MutableRefObject<any>;
}

/**
 * Manages auto-save with debounced triggering and version batching.
 * Owns: auto-save status/error/lastSavedAt, session ID, current value refs,
 * baseline tracking, and the debounced save effect.
 */
export function useAutoSave({
  editorState,
  title,
  location,
  canEdit,
  isSaving,
  isNewPage,
  pageId,
  hasPageTitle,
  onSave,
  lastSavedContentRef,
  lastSavedTitleRef,
  lastSavedLocationRef,
}: UseAutoSaveOptions) {
  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save session ID for version batching - generated once per page load/session
  // All auto-saves with the same session ID will be batched into a single version
  const autoSaveSessionIdRef = useRef<string | null>(null);

  // Refs to hold current values for access inside setTimeout callbacks
  // These avoid stale closure issues in async callbacks
  const currentTitleRef = useRef(title);
  const currentLocationRef = useRef(location);
  const currentEditorStateRef = useRef(editorState);

  // Track whether auto-save baseline has been initialized (separate from refsInitialized)
  // This allows auto-save to work as soon as content is ready, without waiting for full page load
  const autoSaveBaselineInitialized = useRef(false);
  // Track when baseline was just initialized to skip the immediate effect run
  const autoSaveBaselineJustInitialized = useRef(false);

  // Keep current value refs in sync
  useEffect(() => {
    currentTitleRef.current = title;
  }, [title]);

  useEffect(() => {
    currentLocationRef.current = location;
  }, [location]);

  useEffect(() => {
    currentEditorStateRef.current = editorState;
  }, [editorState]);

  // Initialize auto-save baseline as soon as content is ready (don't wait for full page load)
  // This allows auto-save to work even if the page object is still loading
  useEffect(() => {
    if (autoSaveBaselineInitialized.current) return;

    // Initialize baseline as soon as we have valid editorState
    if (editorState && Array.isArray(editorState)) {
      lastSavedContentRef.current = editorState;
      lastSavedTitleRef.current = title || '';
      lastSavedLocationRef.current = location || null;
      autoSaveBaselineInitialized.current = true;
      // Mark that we just initialized - the next auto-save effect run should be skipped
      // to avoid false positives from effect ordering
      autoSaveBaselineJustInitialized.current = true;
    }
  }, [editorState, title, location, lastSavedContentRef, lastSavedTitleRef, lastSavedLocationRef]);

  // Reset auto-save baseline and session ID when page ID changes (navigating to a different page)
  useEffect(() => {
    autoSaveBaselineInitialized.current = false;
    autoSaveSessionIdRef.current = null; // Reset session ID for new page
  }, [pageId]);

  // Generate auto-save session ID when page is loaded for editing
  // This groups all auto-saves within one editing session into a single version
  useEffect(() => {
    if (canEdit && pageId && !autoSaveSessionIdRef.current) {
      // Generate a unique session ID: pageId + timestamp + random suffix
      autoSaveSessionIdRef.current = `autosave-${pageId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }, [canEdit, pageId]);

  // Auto-save effect: triggers save after 1 second of inactivity when there are changes
  useEffect(() => {
    // Don't auto-save if:
    // - Not the owner (canEdit is false)
    // - Currently saving or just saved (prevent infinite loop)
    // - Auto-save baseline not initialized yet (content not ready)
    if (!canEdit || isSaving || !autoSaveBaselineInitialized.current) {
      return;
    }

    // Skip the first run immediately after baseline initialization
    // This prevents false positive "unsaved changes" on initial page load
    if (autoSaveBaselineJustInitialized.current) {
      autoSaveBaselineJustInitialized.current = false;
      return;
    }

    // Prevent re-triggering while save is in progress or just completed
    // This is the key guard against infinite loops
    if (autoSaveStatus === 'saving' || autoSaveStatus === 'saved') {
      return;
    }

    // For new pages, require explicit first save (user needs to set a title)
    if (isNewPage && !hasPageTitle) {
      return;
    }

    // Check for actual changes BEFORE setting pending status
    // This prevents showing "Unsaved changes" on initial load
    const currentTitle = currentTitleRef.current;
    const currentLocation = currentLocationRef.current;
    const currentContent = currentEditorStateRef.current;

    // Check if title changed
    const savedTitle = lastSavedTitleRef.current;
    const titleChanged = savedTitle !== '' && currentTitle !== savedTitle;

    // Check if location changed
    const savedLocation = lastSavedLocationRef.current;
    const locationChanged = JSON.stringify(currentLocation) !== JSON.stringify(savedLocation);

    // Check if content changed
    const savedContent = lastSavedContentRef.current;
    let contentChanged = false;
    if (savedContent && currentContent) {
      try {
        contentChanged = JSON.stringify(savedContent) !== JSON.stringify(currentContent);
      } catch {
        contentChanged = false;
      }
    }

    // If no actual changes, don't proceed - stay in idle state
    if (!titleChanged && !locationChanged && !contentChanged) {
      return;
    }

    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Show "pending" state IMMEDIATELY when changes are detected
    // This gives instant feedback that there are unsaved changes
    setAutoSaveStatus('pending');

    // Set a new timeout for auto-save after 1 second of inactivity
    // This is faster than before (was 2.5s) for a more responsive feel
    autoSaveTimeoutRef.current = setTimeout(async () => {
      // Re-check for actual changes using current refs vs saved refs
      // This avoids stale closure issues by reading refs directly
      const latestTitle = currentTitleRef.current;
      const latestLocation = currentLocationRef.current;
      const latestContent = currentEditorStateRef.current;

      // Check if title changed
      const latestSavedTitle = lastSavedTitleRef.current;
      const latestTitleChanged = latestSavedTitle !== '' && latestTitle !== latestSavedTitle;

      // Check if location changed
      const latestSavedLocation = lastSavedLocationRef.current;
      const latestLocationChanged = JSON.stringify(latestLocation) !== JSON.stringify(latestSavedLocation);

      // Check if content changed
      const latestSavedContent = lastSavedContentRef.current;
      let latestContentChanged = false;
      if (latestSavedContent && latestContent) {
        try {
          latestContentChanged = JSON.stringify(latestSavedContent) !== JSON.stringify(latestContent);
        } catch {
          latestContentChanged = false;
        }
      }

      // If no actual changes, go back to idle state
      if (!latestTitleChanged && !latestLocationChanged && !latestContentChanged) {
        setAutoSaveStatus('idle');
        return;
      }

      setAutoSaveStatus('saving');
      setAutoSaveError(null);

      try {
        // Pass current content and session ID to the save function
        await onSave(latestContent, { isAutoSave: true, sessionId: autoSaveSessionIdRef.current });

        // After save completes, check if user typed more during save
        // The refs were updated in handleSave to what was actually saved
        // Compare current state to saved state to detect new changes
        const postSaveContent = currentEditorStateRef.current;
        const postSaveTitle = currentTitleRef.current;
        const postSaveLocation = currentLocationRef.current;
        const postSavedContent = lastSavedContentRef.current;
        const postSavedTitle = lastSavedTitleRef.current;
        const postSavedLocation = lastSavedLocationRef.current;

        let stillHasChanges = false;
        if (postSavedTitle !== '' && postSaveTitle !== postSavedTitle) {
          stillHasChanges = true;
        }
        if (!stillHasChanges && JSON.stringify(postSaveLocation) !== JSON.stringify(postSavedLocation)) {
          stillHasChanges = true;
        }
        if (!stillHasChanges && postSavedContent && postSaveContent) {
          try {
            stillHasChanges = JSON.stringify(postSavedContent) !== JSON.stringify(postSaveContent);
          } catch {
            // Ignore serialization errors
          }
        }

        if (stillHasChanges) {
          // User typed during save - go back to 'pending' immediately
          // The auto-save effect will trigger another save after 1s
          setAutoSaveStatus('pending');
        } else {
          // All changes were saved - show 'saved' status
          setAutoSaveStatus('saved');
          setLastSavedAt(new Date());
          // Transition to idle after showing saved state
          setTimeout(() => setAutoSaveStatus('idle'), 3000);
        }
      } catch (err) {
        setAutoSaveStatus('error');
        setAutoSaveError(err instanceof Error ? err.message : 'Auto-save failed');
      }
    }, 1000); // 1 second delay (reduced from 2.5s for faster saves)

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [editorState, title, location, canEdit, isSaving, onSave, isNewPage, autoSaveStatus, hasPageTitle, lastSavedContentRef, lastSavedTitleRef, lastSavedLocationRef]);

  return {
    autoSaveStatus,
    autoSaveError,
    lastSavedAt,
    currentEditorStateRef,
  };
}
