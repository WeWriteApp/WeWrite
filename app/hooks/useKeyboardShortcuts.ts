"use client";

import { useEffect } from 'react';

// Types
interface UseKeyboardShortcutsProps {
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  canEdit: boolean;
  handleSave?: (() => void) | null;
  isSaving?: boolean;
}

export const useKeyboardShortcuts = ({
  isEditing,
  setIsEditing,
  canEdit,
  handleSave = null,
  isSaving = false
}: UseKeyboardShortcutsProps): void => {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent): void => {
      // Enter to edit (when viewing)
      if (e.key === 'Enter' && !isEditing && canEdit) {
        e.preventDefault();
        setIsEditing(true);
      }

      // Cmd/Ctrl + Enter to save (when editing)
      if (handleSave && (e.metaKey || e.ctrlKey) && e.key === 'Enter' && isEditing && !isSaving) {
        e.preventDefault();
        handleSave();
      }

      // ESC to cancel edit mode
      if (e.key === 'Escape' && isEditing) {
        e.preventDefault();
        setIsEditing(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isEditing, canEdit, handleSave, isSaving, setIsEditing]);
};