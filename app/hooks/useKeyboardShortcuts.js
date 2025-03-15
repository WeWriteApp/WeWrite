"use client";

import { useEffect } from 'react';

export const useKeyboardShortcuts = ({
  isEditing,
  setIsEditing,
  canEdit,
  handleSave,
  isSaving
}) => {
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Enter to edit (when viewing)
      if (e.key === 'Enter' && !isEditing && canEdit) {
        setIsEditing(true);
      }

      // Cmd/Ctrl + Enter to save (when editing)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && isEditing && !isSaving) {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isEditing, canEdit, handleSave, isSaving, setIsEditing]);
}; 