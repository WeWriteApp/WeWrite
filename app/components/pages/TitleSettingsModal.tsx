"use client";

import React, { useState, useEffect } from 'react';
import { AdaptiveModal } from '../ui/adaptive-modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X, Plus, AlertCircle, Loader2, Tags } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PillLink } from '../utils/PillLink';
import EmptyState from '../ui/EmptyState';

interface TitleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageId: string;
  title: string;
  alternativeTitles: string[];
  onTitleChange: (newTitle: string) => void;
  onAlternativeTitlesChange: (titles: string[]) => void;
  canEdit: boolean;
}

/**
 * TitleSettingsModal - Modal/Drawer for managing page titles
 *
 * Features:
 * - Edit primary title
 * - View and manage alternative titles
 * - Add new alternative titles
 * - Remove alternative titles
 * - Promote alternative title to primary (swap)
 */
export function TitleSettingsModal({
  isOpen,
  onClose,
  pageId,
  title,
  alternativeTitles,
  onTitleChange,
  onAlternativeTitlesChange,
  canEdit
}: TitleSettingsModalProps) {
  const [editingTitle, setEditingTitle] = useState(title);
  const [localAlternatives, setLocalAlternatives] = useState<string[]>(alternativeTitles);
  const [newAltTitle, setNewAltTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Store initial values to compare against
  const [initialTitle, setInitialTitle] = useState(title);
  const [initialAlternatives, setInitialAlternatives] = useState<string[]>(alternativeTitles);

  // Sync state when modal opens (not on every prop change)
  useEffect(() => {
    if (isOpen) {
      setEditingTitle(title);
      setLocalAlternatives(alternativeTitles);
      setInitialTitle(title);
      setInitialAlternatives(alternativeTitles);
      setNewAltTitle('');
      setError(null);
      setHasChanges(false);
    }
  }, [isOpen, title, alternativeTitles]);

  // Track changes - compare against initial values captured when modal opened
  useEffect(() => {
    if (!isOpen) return;
    const titleChanged = editingTitle !== initialTitle;
    const altsChanged = JSON.stringify(localAlternatives) !== JSON.stringify(initialAlternatives);
    setHasChanges(titleChanged || altsChanged);
  }, [editingTitle, localAlternatives, initialTitle, initialAlternatives, isOpen]);

  const handleAddAlternative = () => {
    const trimmed = newAltTitle.trim();

    if (!trimmed) {
      setError('Please enter a title');
      return;
    }

    // Check if matches primary (case-insensitive)
    if (trimmed.toLowerCase() === editingTitle.toLowerCase()) {
      setError('Alternative title cannot be the same as the primary title');
      return;
    }

    // Check if already exists (case-insensitive)
    if (localAlternatives.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      setError('This alternative title already exists');
      return;
    }

    setLocalAlternatives([...localAlternatives, trimmed]);
    setNewAltTitle('');
    setError(null);
  };

  const handleRemoveAlternative = (titleToRemove: string) => {
    setLocalAlternatives(localAlternatives.filter(t => t !== titleToRemove));
  };

  const handlePromoteAlternative = (titleToPromote: string) => {
    // Swap: promote the alternative to primary, demote current primary to alternative
    const oldPrimary = editingTitle;
    const newAlternatives = localAlternatives.filter(t => t !== titleToPromote);
    newAlternatives.push(oldPrimary);

    setEditingTitle(titleToPromote);
    setLocalAlternatives(newAlternatives);
  };

  const handleSave = async () => {
    if (!canEdit) return;

    setIsLoading(true);
    setError(null);

    try {
      // Update primary title if changed
      if (editingTitle !== initialTitle) {
        onTitleChange(editingTitle);
      }

      // Update alternative titles if changed
      if (JSON.stringify(localAlternatives) !== JSON.stringify(initialAlternatives)) {
        // Call API to update alternative titles
        const response = await fetch(`/api/pages/${pageId}/alternative-titles`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titles: localAlternatives })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update alternative titles');
        }

        onAlternativeTitlesChange(localAlternatives);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddAlternative();
    }
  };

  return (
    <AdaptiveModal
      isOpen={isOpen}
      onClose={onClose}
      title="Title Settings"
      mobileHeight="70vh"
    >
      <div className="flex flex-col gap-6">
        {/* Primary Title Section */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Primary Title
          </label>
          <Input
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            placeholder="Enter page title..."
            disabled={!canEdit}
            className="text-base"
          />
          <p className="text-xs text-muted-foreground">
            This is the main title displayed on the page and in search results.
          </p>
        </div>

        {/* Alternative Titles Section */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground">
              Alternative Titles
            </label>
            <p className="text-xs text-muted-foreground mt-1">
              These titles can also be used to find this page in search.
            </p>
          </div>

          {/* List of alternative titles as pill links */}
          {localAlternatives.length > 0 ? (
            <div className="flex flex-wrap gap-2 items-center">
              {localAlternatives.map((altTitle, index) => (
                <div key={index} className="inline-flex items-center gap-1">
                  <PillLink
                    href="#"
                    clickable={false}
                    onClick={(e) => {
                      e.preventDefault();
                      if (canEdit) handlePromoteAlternative(altTitle);
                    }}
                    className="cursor-pointer"
                  >
                    {altTitle}
                  </PillLink>
                  {canEdit && (
                    <button
                      onClick={() => handleRemoveAlternative(altTitle)}
                      className="p-1 rounded-full hover:bg-muted transition-colors -ml-1"
                      title="Remove alternative title"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Tags}
              title="No alternative titles"
              description="Add alternative titles to help people find this page with different search terms."
              size="sm"
            />
          )}

          {/* Add new alternative title */}
          {canEdit && (
            <div className="flex items-center gap-2">
              <Input
                value={newAltTitle}
                onChange={(e) => {
                  setNewAltTitle(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Add alternative title..."
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleAddAlternative}
                disabled={!newAltTitle.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4" style={{ borderTop: '1px solid var(--card-border)' }}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {canEdit && (
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          )}
        </div>
      </div>
    </AdaptiveModal>
  );
}

export default TitleSettingsModal;
