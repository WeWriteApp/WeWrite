"use client";
import React, { useState, useEffect, useCallback, useContext, useRef, useMemo } from "react";
import { Button } from "../ui/button";
import { Icon } from '@/components/ui/Icon';
import { getUserProfile } from "../../utils/apiClient";
import { toast } from "../ui/use-toast";
// REMOVED: recordBioEditActivity - bio activity tracking disabled for cost optimization
import dynamic from "next/dynamic";
import { useAuth } from '../../providers/AuthProvider';
import { useFeatureFlags } from '../../contexts/FeatureFlagContext';

import EmptyContentState from './EmptyContentState';
import { UserBioSkeleton } from "../ui/page-skeleton";

import TextView from "../editor/TextView";
import HoverEditContent from './HoverEditContent';
import ContentPageFooter from "../pages/ContentPageFooter";
import StickySaveHeader from "../layout/StickySaveHeader";
import AutoSaveIndicator from "../layout/AutoSaveIndicator";
import type { UserBioTabProps } from "../../types/components";
import type { EditorContent, User } from "../../types/database";
import { PageProvider } from "../../contexts/PageContext";

// Import the unified ContentDisplay component
const ContentDisplay = dynamic(() => import("../content/ContentDisplay"), { ssr: false });

const UserBioTab: React.FC<UserBioTabProps> = ({ profile }) => {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();

  // Check if auto-save is enabled via feature flag
  const autoSaveEnabled = isEnabled('auto_save');

  // Always editing mode - bio is always editable for the owner
  const isProfileOwner = user?.uid === profile.uid;
  const [isEditing, setIsEditing] = useState<boolean>(isProfileOwner); // Always true for owner
  const [bioContent, setBioContent] = useState<EditorContent | string>("");
  const [originalContent, setOriginalContent] = useState<EditorContent | string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEditor, setLastEditor] = useState<string | null>(null);
  const [lastEditTime, setLastEditTime] = useState<string | null>(null);

  // Auto-save state (only used when auto_save feature flag is enabled)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs to track current content for auto-save comparison (avoids stale closures)
  const currentContentRef = useRef<EditorContent | string>("");
  const lastSavedContentRef = useRef<EditorContent | string>("");
  const autoSaveBaselineInitialized = useRef<boolean>(false);
  const autoSaveBaselineJustInitialized = useRef<boolean>(false);

  // Link insertion trigger function
  const [linkInsertionTrigger, setLinkInsertionTrigger] = useState<(() => void) | null>(null);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number; clientX: number; clientY: number } | null>(null);

  // Track if content has changed
  const hasUnsavedChanges = isEditing && bioContent !== originalContent;

  // Enhanced setIsEditing function that captures click position
  // For always-editing mode, this doesn't change the editing state for owners
  const handleSetIsEditing = (editing: boolean, position: { x: number; y: number; clientX: number; clientY: number } | null = null) => {
    if (!isProfileOwner) {
      setIsEditing(editing); // Only change for non-owners (visitors)
    }
    if (editing && position) {
      setClickPosition(position);
    } else if (!editing) {
      setClickPosition(null); // Clear position when exiting edit mode
    }
  };

  // Load the bio content from the database using API route
  useEffect(() => {
    const fetchBioContent = async () => {
      try {
        setIsLoading(true);

        // Use API route for bio loading to handle environment-aware operations
        // Add cache-busting to ensure fresh data on every load
        const response = await fetch(`/api/users/${profile.uid}/bio`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });

        console.log('🔍 UserBioTab: API response status:', response.status);

        if (response.ok) {
          const bioResponse = await response.json();
          const bioData = bioResponse.data; // Extract data from API response

          console.log('🔍 UserBioTab: API response data:', {
            hasBio: !!bioData.bio,
            bioType: typeof bioData.bio,
            bioIsArray: Array.isArray(bioData.bio),
            bioLength: bioData.bio ? (Array.isArray(bioData.bio) ? bioData.bio.length : bioData.bio.length) : 0,
            bioSample: typeof bioData.bio === 'string' ? bioData.bio.substring(0, 100) : JSON.stringify(bioData.bio).substring(0, 100)
          });

          if (bioData.bio) {
            setBioContent(bioData.bio);
            setOriginalContent(bioData.bio);
            // Initialize auto-save baseline refs
            currentContentRef.current = bioData.bio;
            lastSavedContentRef.current = bioData.bio;
            autoSaveBaselineInitialized.current = true;
            autoSaveBaselineJustInitialized.current = true;
          }
          if (bioData.bioLastEditor) {
            setLastEditor(bioData.bioLastEditor);
          }
          if (bioData.bioLastEditTime) {
            setLastEditTime(bioData.bioLastEditTime);
          }
        } else {
          // Fallback to getUserProfile if API route fails
          console.warn('API route failed, falling back to getUserProfile');
          const userData = await getUserProfile(profile.uid);

          if (userData) {
            if (userData.bio) {
              setBioContent(userData.bio);
              setOriginalContent(userData.bio);
              // Initialize auto-save baseline refs
              currentContentRef.current = userData.bio;
              lastSavedContentRef.current = userData.bio;
              autoSaveBaselineInitialized.current = true;
              autoSaveBaselineJustInitialized.current = true;
            }
            if (userData.bioLastEditor) {
              setLastEditor(userData.bioLastEditor);
            }
            if (userData.bioLastEditTime) {
              setLastEditTime(userData.bioLastEditTime);
            }
          } else {
            console.warn(`No user data found for uid: ${profile.uid}`);
            setError("User profile not found. This may be a development environment issue.");
          }
        }
      } catch (err) {
        console.error("Error fetching user bio content:", err);
        setError("Failed to load user information. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBioContent();
  }, [profile.uid]);

  // Handle saving the bio content
  const handleSave = async () => {
    try {
      setIsLoading(true);

      // Ensure we're saving the content in the correct format
      // The Editor returns an array of nodes, which we want to preserve
      const contentToSave = bioContent;
      const editorName = user?.username || "Unknown";

      console.log("Saving bio content:", contentToSave);

      // Use API route for bio updates to handle environment-aware operations
      const response = await fetch(`/api/users/${profile.uid}/bio`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bio: contentToSave,
          editorName: editorName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save bio');
      }

      const result = await response.json();

      // REMOVED: Bio edit activity recording disabled for cost optimization
      console.log("Bio edit activity recording disabled for cost optimization");

      setOriginalContent(contentToSave);
      // Update the last saved content ref for auto-save comparison
      lastSavedContentRef.current = contentToSave;
      // Don't exit editing mode for owners (always-editing mode)
      if (!isProfileOwner) {
        handleSetIsEditing(false);
      }
      setLastEditor(editorName);
      setLastEditTime(new Date().toISOString());

      return true; // Indicate success for the useUnsavedChanges hook
    } catch (err) {
      console.error("Error updating user bio content:", err);
      setError("Failed to save changes. Please try again.");
      toast.error("Failed to update bio");
      return false; // Indicate failure for the useUnsavedChanges hook
    } finally {
      setIsLoading(false);
    }
  };

  // Handle beforeunload for browser/tab close - uses system dialog
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle canceling edits with unsaved changes check - uses system dialog
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to discard them?'
      );
      if (confirmed) {
        setBioContent(originalContent);
        if (!isProfileOwner) {
          handleSetIsEditing(false);
        }
      }
    } else {
      // No changes, just revert content (stay in editing mode for owners)
      setBioContent(originalContent);
      if (!isProfileOwner) {
        handleSetIsEditing(false);
      }
    }
  };

  // Handle content change in the editor
  const handleContentChange = (content) => {
    // Ensure we're storing the content in the correct format
    // If it's already an object/array, use it directly; otherwise stringify it
    setBioContent(content);
    // Update current content ref for auto-save comparison
    currentContentRef.current = content;
    console.log("Bio content updated:", content);
  };

  // Keyboard shortcuts for bio editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to save
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (isProfileOwner && hasUnsavedChanges && !isLoading) {
          handleSave();
        }
      }

      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isProfileOwner && hasUnsavedChanges && !isLoading) {
          handleSave();
        }
      }

      // Escape to cancel (revert changes)
      if (e.key === 'Escape' && isProfileOwner) {
        e.preventDefault();
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProfileOwner, hasUnsavedChanges, isLoading, handleSave, handleCancel]);

  // Auto-save effect: triggers save after 1 second of inactivity when there are changes
  // Only active when auto_save feature flag is enabled
  useEffect(() => {
    // Skip if auto-save is disabled via feature flag
    if (!autoSaveEnabled) {
      return;
    }

    // Don't auto-save if:
    // - Not the profile owner (canEdit is false)
    // - Currently saving or just saved (prevent infinite loop)
    // - Auto-save baseline not initialized yet (content not ready)
    if (!isProfileOwner || isLoading || !autoSaveBaselineInitialized.current) {
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

    // Check for actual changes using refs
    const currentContent = currentContentRef.current;
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
    if (!contentChanged) {
      return;
    }

    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Show "pending" state IMMEDIATELY when changes are detected
    setAutoSaveStatus('pending');

    // Set a new timeout for auto-save after 1 second of inactivity
    autoSaveTimeoutRef.current = setTimeout(async () => {
      // Re-check for actual changes using refs
      const latestContent = currentContentRef.current;
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
      if (!latestContentChanged) {
        setAutoSaveStatus('idle');
        return;
      }

      setAutoSaveStatus('saving');
      setAutoSaveError(null);

      try {
        await handleSave();
        setAutoSaveStatus('saved');
        setLastSavedAt(new Date());
        // Transition to idle after showing saved state
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      } catch (err) {
        setAutoSaveStatus('error');
        setAutoSaveError(err instanceof Error ? err.message : 'Auto-save failed');
      }
    }, 1000); // 1 second delay

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [autoSaveEnabled, bioContent, isProfileOwner, isLoading, handleSave, autoSaveStatus]);

  // Handle link insertion request - memoized to prevent infinite loops
  const handleInsertLinkRequest = useCallback((triggerFn) => {
    setLinkInsertionTrigger(() => triggerFn);
  }, []);

  if (isLoading && !bioContent) {
    return (
      <div className="py-8">
        <UserBioSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Icon name="Warning" size={48} className="text-amber-500 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Something went wrong</h3>
        <p className="text-muted-foreground text-center mb-4">{error}</p>
        <Button
          variant="secondary"
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Save UI - Either StickySaveHeader (manual) or AutoSaveIndicator (auto) */}
      {autoSaveEnabled ? (
        /* Auto-save mode: Show indicator instead of save bar */
        isProfileOwner && (
          <div className="flex justify-end px-4 py-2">
            <AutoSaveIndicator
              status={autoSaveStatus}
              lastSavedAt={lastSavedAt}
              error={autoSaveError}
            />
          </div>
        )
      ) : (
        /* Manual save mode: Show sticky save header */
        <StickySaveHeader
          hasUnsavedChanges={hasUnsavedChanges && isProfileOwner}
          onSave={handleSave}
          onCancel={handleCancel}
          isSaving={isLoading}
          isAnimatingOut={false}
        />
      )}

      <div className="space-y-4 page-content-wrapper">
      {/* Content display or editor - unified container structure */}
      <div className="page-content unified-editor relative rounded-lg bg-background w-full max-w-none">
        {isProfileOwner ? (
          <div className="animate-in fade-in-0 duration-300">
            <PageProvider>
              <ContentDisplay
                  content={bioContent}
                  isEditable={true}
                  onChange={handleContentChange}
                  isSaving={isLoading}
                  error={error || ""}
                  placeholder="Write your bio..."
                  showToolbar={false}
                  onInsertLinkRequest={handleInsertLinkRequest}
                  // Remove onSave and onCancel - handled by bottom save bar
                />

              {/* Page Footer with bottom save bar - hidden when auto-save is enabled */}
              {!autoSaveEnabled && (
                <ContentPageFooter
                  page={null} // Bio doesn't have page data
                  content={bioContent}
                  linkedPageIds={[]} // Bio doesn't have linked pages
                  isEditing={isEditing}
                  canEdit={isProfileOwner}
                  isOwner={isProfileOwner}
                  title="" // Bio doesn't have a title
                  location={null} // Bio doesn't have location
                  onTitleChange={() => {}} // Bio doesn't have title
                  onLocationChange={() => {}} // Bio doesn't have location
                  onSave={async () => {
                    const success = await handleSave();
                    return success;
                  }}
                  onCancel={handleCancel}
                  onDelete={null} // Bio doesn't have delete
                  onInsertLink={() => linkInsertionTrigger && linkInsertionTrigger()}
                  isSaving={isLoading}
                  error={error}
                  titleError={false}
                  hasUnsavedChanges={hasUnsavedChanges}
                />
              )}
            </PageProvider>
          </div>
        ) : (
          <div className="max-w-none">
            {bioContent ? (
              <ContentDisplay
                content={bioContent}
                isEditable={false}
                showToolbar={false}
                showLineNumbers={false}
                className="prose dark:prose-invert max-w-none"
              />
            ) : (
              <EmptyContentState
                onActivate={() => handleSetIsEditing(true)}
                isOwner={isProfileOwner}
                ownerMessage="You haven't added a bio yet."
                visitorMessage={`${profile.username || "This user"} hasn't added a bio yet.`}
                placeholder="Share information about yourself, your interests, or your background."
              />
            )}
          </div>
        )}
      </div>
      </div>
    </>
  );
};

export default UserBioTab;
