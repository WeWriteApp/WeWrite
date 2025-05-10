"use client";

import { useState, useEffect, useRef } from 'react';

/**
 * Hook for automatically saving content to localStorage
 * 
 * @param {string} key - The localStorage key to use
 * @param {any} initialValue - Initial value if nothing is in localStorage
 * @param {number} saveInterval - Interval in milliseconds between saves (default: 5000ms)
 * @param {boolean} enabled - Whether auto-save is enabled (default: true)
 * @returns {[any, Function, Function, boolean]} - [value, setValue, clearSavedData, isSaving]
 */
export function useAutoSave(key, initialValue, saveInterval = 5000, enabled = true) {
  // Get stored value from localStorage on initial render
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    
    try {
      const item = window.localStorage.getItem(key);
      // Parse stored json or return initialValue if none
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  // Track if we're currently saving
  const [isSaving, setIsSaving] = useState(false);
  
  // Use a ref to track the latest value without triggering effects
  const valueRef = useRef(value);
  
  // Update the ref whenever the value changes
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Set up auto-save interval
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Function to save current value to localStorage
    const saveToStorage = () => {
      try {
        setIsSaving(true);
        const currentValue = valueRef.current;
        
        // Only save if we have a value
        if (currentValue) {
          window.localStorage.setItem(key, JSON.stringify(currentValue));
          console.log(`Auto-saved content for ${key}`);
        }
      } catch (error) {
        console.error('Error saving to localStorage:', error);
      } finally {
        setIsSaving(false);
      }
    };

    // Set up interval for auto-saving
    const intervalId = setInterval(saveToStorage, saveInterval);

    // Also save when window loses focus
    const handleBlur = () => {
      saveToStorage();
    };

    // Add event listener for when window loses focus
    window.addEventListener('blur', handleBlur);

    // Clean up interval and event listener
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('blur', handleBlur);
    };
  }, [key, saveInterval, enabled]);

  // Function to clear saved data
  const clearSavedData = () => {
    try {
      window.localStorage.removeItem(key);
      console.log(`Cleared saved data for ${key}`);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  };

  return [value, setValue, clearSavedData, isSaving];
}

/**
 * Hook specifically for auto-saving editor content
 * 
 * @param {string} pageId - ID of the page being edited (or 'new' for new pages)
 * @param {any} initialContent - Initial content for the editor
 * @returns {[any, Function, Function, boolean]} - [content, setContent, clearSavedContent, isSaving]
 */
export function useEditorAutoSave(pageId, initialContent) {
  const storageKey = `editor_autosave_${pageId || 'new'}`;
  
  return useAutoSave(storageKey, initialContent, 3000);
}

export default useAutoSave;
