"use client";

import { useState } from 'react';

/**
 * Hook that replaces the previous autosave functionality
 * Autosave has been removed as per requirements
 *
 * @param {string} key - The localStorage key (unused, kept for API compatibility)
 * @param {any} initialValue - Initial value
 * @returns {[any, Function, Function, boolean]} - [value, setValue, clearSavedData, isSaving]
 */
export function useAutoSave(key, initialValue) {
  // Simple state management without autosave
  const [value, setValue] = useState(initialValue);

  // Dummy function that does nothing (kept for API compatibility)
  const clearSavedData = () => {};

  // Always false since we're not saving
  const isSaving = false;

  return [value, setValue, clearSavedData, isSaving];
}

/**
 * Hook that replaces the previous editor autosave functionality
 * Autosave has been removed as per requirements
 *
 * @param {string} pageId - ID of the page being edited (unused, kept for API compatibility)
 * @param {any} initialContent - Initial content for the editor
 * @returns {[any, Function, Function, boolean]} - [content, setContent, clearSavedContent, isSaving]
 */
export function useEditorAutoSave(pageId, initialContent) {
  return useAutoSave('', initialContent);
}

export default useAutoSave;
