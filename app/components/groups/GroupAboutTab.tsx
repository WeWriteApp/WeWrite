'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import AutoSaveIndicator from '../layout/AutoSaveIndicator';

export interface GroupAboutTabProps {
  groupId: string;
  initialDescription: string;
  canEdit: boolean;
  onSaved?: (description: string) => void;
}

const MAX_DESCRIPTION_LENGTH = 500;
const DESCRIPTION_PLACEHOLDER = 'Add a short description for this group…';

export default function GroupAboutTab({
  groupId,
  initialDescription,
  canEdit,
  onSaved,
}: GroupAboutTabProps) {
  const [description, setDescription] = useState(initialDescription);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for auto-save comparison (avoids stale closures)
  const currentContentRef = useRef<string>(initialDescription);
  const lastSavedContentRef = useRef<string>(initialDescription);
  const autoSaveBaselineInitialized = useRef<boolean>(false);
  const autoSaveBaselineJustInitialized = useRef<boolean>(false);

  // Initialize baseline when initialDescription arrives
  useEffect(() => {
    setDescription(initialDescription);
    currentContentRef.current = initialDescription;
    lastSavedContentRef.current = initialDescription;
    autoSaveBaselineInitialized.current = true;
    autoSaveBaselineJustInitialized.current = true;
  }, [initialDescription]);

  const handleChange = (value: string) => {
    const trimmed = value.slice(0, MAX_DESCRIPTION_LENGTH);
    setDescription(trimmed);
    currentContentRef.current = trimmed;
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const contentToSave = currentContentRef.current.trim();
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ description: contentToSave }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save description');
      }
      lastSavedContentRef.current = contentToSave;
      onSaved?.(contentToSave);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save description';
      toast.error(msg);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [groupId, onSaved]);

  // Auto-save effect: 1-second debounce after changes
  useEffect(() => {
    if (!canEdit || isSaving || !autoSaveBaselineInitialized.current) return;

    // Skip first run after baseline initialization
    if (autoSaveBaselineJustInitialized.current) {
      autoSaveBaselineJustInitialized.current = false;
      return;
    }

    if (autoSaveStatus === 'saving' || autoSaveStatus === 'saved') return;

    // Check for actual changes
    const currentContent = currentContentRef.current;
    const savedContent = lastSavedContentRef.current;
    const contentChanged = currentContent !== savedContent;

    if (!contentChanged) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    setAutoSaveStatus('pending');

    autoSaveTimeoutRef.current = setTimeout(async () => {
      // Re-check for changes
      const latestContent = currentContentRef.current;
      const latestSaved = lastSavedContentRef.current;
      if (latestContent === latestSaved) {
        setAutoSaveStatus('idle');
        return;
      }

      setAutoSaveStatus('saving');
      setAutoSaveError(null);

      try {
        const success = await handleSave();
        if (success) {
          setAutoSaveStatus('saved');
          setLastSavedAt(new Date());
          setTimeout(() => setAutoSaveStatus('idle'), 3000);
        } else {
          setAutoSaveStatus('error');
          setAutoSaveError('Save failed');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Auto-save failed';
        setAutoSaveStatus('error');
        setAutoSaveError(errorMessage);
      }
    }, 1000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [description, canEdit, isSaving, handleSave, autoSaveStatus]);

  if (!canEdit) {
    return (
      <div className="wewrite-card p-4">
        {description ? (
          <p className="text-sm text-foreground whitespace-pre-wrap">{description}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No description yet.</p>
        )}
      </div>
    );
  }

  return (
    <div className="wewrite-card p-4 space-y-4">
      <div className="flex items-center justify-end">
        <AutoSaveIndicator
          status={autoSaveStatus}
          lastSavedAt={lastSavedAt}
          error={autoSaveError}
        />
      </div>
      <Textarea
        value={description}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={DESCRIPTION_PLACEHOLDER}
        className="min-h-[120px] resize-none"
        maxLength={MAX_DESCRIPTION_LENGTH}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {description.length} / {MAX_DESCRIPTION_LENGTH}
        </span>
      </div>
    </div>
  );
}
