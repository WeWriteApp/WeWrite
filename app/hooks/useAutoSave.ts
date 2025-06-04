"use client";

import { useState } from 'react';

// Types
type AutoSaveReturn<T> = [T, (value: T) => void, () => void, boolean];

/**
 * Hook that replaces the previous autosave functionality
 * Autosave has been removed as per requirements
 */
export function useAutoSave<T>(key: string, initialValue: T): AutoSaveReturn<T> {
  // Simple state management without autosave
  const [value, setValue] = useState<T>(initialValue);

  // Dummy function that does nothing (kept for API compatibility)
  const clearSavedData = (): void => {};

  // Always false since we're not saving
  const isSaving = false;

  return [value, setValue, clearSavedData, isSaving];
}

/**
 * Hook that replaces the previous editor autosave functionality
 * Autosave has been removed as per requirements
 */
export function useEditorAutoSave<T>(pageId: string, initialContent: T): AutoSaveReturn<T> {
  return useAutoSave('', initialContent);
}

export default useAutoSave;
