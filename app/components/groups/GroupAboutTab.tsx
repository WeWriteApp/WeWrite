'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import { toast } from '@/components/ui/use-toast';
import AutoSaveIndicator from '../layout/AutoSaveIndicator';
import { PageProvider } from '../../contexts/PageContext';

const ContentDisplay = dynamic(() => import('../content/ContentDisplay'), { ssr: false });

export interface GroupAboutTabProps {
  groupId: string;
  initialDescription: any;
  canEdit: boolean;
  onSaved?: (description: any) => void;
}

const DESCRIPTION_PLACEHOLDER = 'Add a short description for this group…';

/** Convert a legacy plain-text description into Slate JSON */
function toSlateContent(value: any): any {
  if (!value) return [{ type: 'paragraph', children: [{ text: '' }] }];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    // Try to parse as Slate JSON first
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // plain text — wrap each line as a paragraph
    }
    const lines = value.split('\n');
    return lines.map((line: string) => ({
      type: 'paragraph',
      children: [{ text: line }],
    }));
  }
  return [{ type: 'paragraph', children: [{ text: '' }] }];
}

export default function GroupAboutTab({
  groupId,
  initialDescription,
  canEdit,
  onSaved,
}: GroupAboutTabProps) {
  const [content, setContent] = useState<any>(() => toSlateContent(initialDescription));
  const [isSaving, setIsSaving] = useState(false);

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for auto-save comparison (avoids stale closures)
  const currentContentRef = useRef<any>(toSlateContent(initialDescription));
  const lastSavedContentRef = useRef<any>(toSlateContent(initialDescription));
  const autoSaveBaselineInitialized = useRef<boolean>(false);
  const autoSaveBaselineJustInitialized = useRef<boolean>(false);

  // Link insertion trigger (passed up from Editor via ContentDisplay)
  const [linkInsertionTrigger, setLinkInsertionTrigger] = useState<(() => void) | null>(null);

  const handleInsertLinkRequest = useCallback((triggerFn: () => void) => {
    setLinkInsertionTrigger(() => triggerFn);
  }, []);

  // Initialize baseline when initialDescription arrives
  useEffect(() => {
    const slate = toSlateContent(initialDescription);
    setContent(slate);
    currentContentRef.current = slate;
    lastSavedContentRef.current = slate;
    autoSaveBaselineInitialized.current = true;
    autoSaveBaselineJustInitialized.current = true;
  }, [initialDescription]);

  const handleContentChange = useCallback((newContent: any) => {
    setContent(newContent);
    currentContentRef.current = newContent;
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const contentToSave = currentContentRef.current;
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

    // Check for actual changes (compare JSON snapshots)
    const currentJSON = JSON.stringify(currentContentRef.current);
    const savedJSON = JSON.stringify(lastSavedContentRef.current);
    if (currentJSON === savedJSON) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    setAutoSaveStatus('pending');

    autoSaveTimeoutRef.current = setTimeout(async () => {
      const latestJSON = JSON.stringify(currentContentRef.current);
      const latestSavedJSON = JSON.stringify(lastSavedContentRef.current);
      if (latestJSON === latestSavedJSON) {
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
  }, [content, canEdit, isSaving, handleSave, autoSaveStatus]);

  if (!canEdit) {
    return (
      <div>
        {initialDescription ? (
          <ContentDisplay
            content={toSlateContent(initialDescription)}
            isEditable={false}
            showToolbar={false}
            showLineNumbers={false}
            className="prose dark:prose-invert max-w-none"
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">No description yet.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          {linkInsertionTrigger && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-2xl font-medium"
              onClick={() => linkInsertionTrigger()}
            >
              <Icon name="Link" size={16} />
              <span>Insert Link</span>
            </Button>
          )}
        </div>
        <AutoSaveIndicator
          status={autoSaveStatus}
          lastSavedAt={lastSavedAt}
          error={autoSaveError}
        />
      </div>
      <PageProvider>
        <ContentDisplay
          content={content}
          isEditable={true}
          onChange={handleContentChange}
          isSaving={isSaving}
          placeholder={DESCRIPTION_PLACEHOLDER}
          showToolbar={false}
          onInsertLinkRequest={handleInsertLinkRequest}
        />
      </PageProvider>
    </div>
  );
}
