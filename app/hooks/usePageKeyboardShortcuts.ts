import { useEffect } from 'react';

interface UsePageKeyboardShortcutsOptions {
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
}

/**
 * Registers keyboard shortcuts for page editing: Cmd+S, Cmd+Enter, Escape.
 */
export function usePageKeyboardShortcuts({
  onSave,
  onCancel,
  isEditing,
}: UsePageKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave();
        return;
      }

      // Cmd/Ctrl + Enter to save
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onSave();
        return;
      }

      // Escape to cancel editing
      if (e.key === 'Escape' && isEditing) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSave, onCancel, isEditing]);
}
