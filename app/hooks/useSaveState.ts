"use client";

import { useState, useCallback, useEffect } from 'react';

/**
 * Centralized save state management hook
 * 
 * This hook consolidates all save-related state and logic into a single,
 * reusable interface that can be used across different components.
 */

export interface SaveState {
  // Change tracking
  hasContentChanged: boolean;
  hasTitleChanged: boolean;
  hasLocationChanged: boolean;
  hasUnsavedChanges: boolean;
  
  // Save operation state
  isSaving: boolean;
  saveSuccess: boolean;
  saveError: string | null;
  
  // Animation state
  isAnimatingOut: boolean;
}

export interface SaveActions {
  // Change tracking actions
  setContentChanged: (changed: boolean) => void;
  setTitleChanged: (changed: boolean) => void;
  setLocationChanged: (changed: boolean) => void;
  
  // Save operation actions
  startSaving: () => void;
  completeSave: () => void;
  failSave: (error: string) => void;
  resetSaveState: () => void;
  
  // Revert action
  revertChanges: () => void;
}

export interface UseSaveStateReturn {
  state: SaveState;
  actions: SaveActions;
}

/**
 * Custom hook for managing save state
 */
export function useSaveState(): UseSaveStateReturn {
  // Individual change flags
  const [hasContentChanged, setHasContentChanged] = useState(false);
  const [hasTitleChanged, setHasTitleChanged] = useState(false);
  const [hasLocationChanged, setHasLocationChanged] = useState(false);
  
  // Save operation state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Animation state
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  
  // Computed state: any changes exist
  const hasUnsavedChanges = hasContentChanged || hasTitleChanged || hasLocationChanged;
  
  // Handle save success animation
  useEffect(() => {
    if (saveSuccess && !hasUnsavedChanges) {
      setIsAnimatingOut(true);
      const timer = setTimeout(() => {
        setIsAnimatingOut(false);
        setSaveSuccess(false);
      }, 300); // Match animation duration
      
      return () => clearTimeout(timer);
    }
  }, [saveSuccess, hasUnsavedChanges]);
  
  // Actions
  const actions: SaveActions = {
    // Change tracking
    setContentChanged: useCallback((changed: boolean) => {
      setHasContentChanged(changed);
      if (changed) setSaveError(null); // Clear errors when making changes
    }, []),
    
    setTitleChanged: useCallback((changed: boolean) => {
      setHasTitleChanged(changed);
      if (changed) setSaveError(null);
    }, []),
    
    setLocationChanged: useCallback((changed: boolean) => {
      setHasLocationChanged(changed);
      if (changed) setSaveError(null);
    }, []),
    
    // Save operations
    startSaving: useCallback(() => {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);
    }, []),
    
    completeSave: useCallback(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setSaveError(null);
      
      // Reset all change flags
      setHasContentChanged(false);
      setHasTitleChanged(false);
      setHasLocationChanged(false);
    }, []),
    
    failSave: useCallback((error: string) => {
      setIsSaving(false);
      setSaveError(error);
      setSaveSuccess(false);
    }, []),
    
    resetSaveState: useCallback(() => {
      setIsSaving(false);
      setSaveSuccess(false);
      setSaveError(null);
      setIsAnimatingOut(false);
    }, []),
    
    // Revert all changes
    revertChanges: useCallback(() => {
      setHasContentChanged(false);
      setHasTitleChanged(false);
      setHasLocationChanged(false);
      setSaveError(null);
      setSaveSuccess(false);
      setIsAnimatingOut(false);
    }, [])
  };
  
  // State object
  const state: SaveState = {
    hasContentChanged,
    hasTitleChanged,
    hasLocationChanged,
    hasUnsavedChanges,
    isSaving,
    saveSuccess,
    saveError,
    isAnimatingOut
  };
  
  return {
    state,
    actions
  };
}

/**
 * Helper hook for components that only need to track a single type of change
 */
export function useSimpleSaveState(changeType: 'content' | 'title' | 'location') {
  const { state, actions } = useSaveState();
  
  const setChanged = useCallback((changed: boolean) => {
    switch (changeType) {
      case 'content':
        actions.setContentChanged(changed);
        break;
      case 'title':
        actions.setTitleChanged(changed);
        break;
      case 'location':
        actions.setLocationChanged(changed);
        break;
    }
  }, [actions, changeType]);
  
  return {
    hasChanged: changeType === 'content' ? state.hasContentChanged :
                changeType === 'title' ? state.hasTitleChanged :
                state.hasLocationChanged,
    hasUnsavedChanges: state.hasUnsavedChanges,
    isSaving: state.isSaving,
    saveError: state.saveError,
    setChanged,
    ...actions
  };
}

export default useSaveState;
