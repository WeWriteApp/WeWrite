"use client";

import { useState, useCallback } from 'react';

interface PromptOptions {
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  inputType?: 'text' | 'password' | 'email';
}

interface PromptState {
  isOpen: boolean;
  title: string;
  message: string;
  placeholder: string;
  defaultValue: string;
  confirmText: string;
  cancelText: string;
  inputType: 'text' | 'password' | 'email';
  isLoading: boolean;
}

/**
 * Hook for managing prompt modals
 * 
 * This hook provides a clean API for showing prompt dialogs
 * and replaces the need for prompt() calls.
 * 
 * @returns Object with prompt state and control functions
 */
export function usePrompt() {
  const [promptState, setPromptState] = useState<PromptState>({
    isOpen: false,
    title: '',
    message: '',
    placeholder: '',
    defaultValue: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    inputType: 'text',
    isLoading: false
  });

  /**
   * Show a prompt modal
   * 
   * @param options - Configuration for the prompt modal
   * @returns Promise that resolves to the input value or null if cancelled
   */
  const showPrompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptState({
        isOpen: true,
        title: options.title,
        message: options.message,
        placeholder: options.placeholder || '',
        defaultValue: options.defaultValue || '',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        inputType: options.inputType || 'text',
        isLoading: false
      });

      // Store the resolve function to call when modal is closed
      (window as any).__promptResolve = resolve;
    });
  }, []);

  /**
   * Close the prompt modal with a value
   */
  const confirmPrompt = useCallback((value: string) => {
    setPromptState(prev => ({ ...prev, isOpen: false }));
    
    // Resolve the promise with the value
    if ((window as any).__promptResolve) {
      (window as any).__promptResolve(value);
      delete (window as any).__promptResolve;
    }
  }, []);

  /**
   * Close the prompt modal without a value (cancelled)
   */
  const cancelPrompt = useCallback(() => {
    setPromptState(prev => ({ ...prev, isOpen: false }));
    
    // Resolve the promise with null (cancelled)
    if ((window as any).__promptResolve) {
      (window as any).__promptResolve(null);
      delete (window as any).__promptResolve;
    }
  }, []);

  /**
   * Set loading state for the prompt
   */
  const setPromptLoading = useCallback((loading: boolean) => {
    setPromptState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  /**
   * Convenience method for password prompts
   */
  const promptPassword = useCallback((title: string, message: string): Promise<string | null> => {
    return showPrompt({
      title,
      message,
      inputType: 'password',
      placeholder: 'Enter password...'
    });
  }, [showPrompt]);

  /**
   * Convenience method for email prompts
   */
  const promptEmail = useCallback((title: string, message: string): Promise<string | null> => {
    return showPrompt({
      title,
      message,
      inputType: 'email',
      placeholder: 'Enter email address...'
    });
  }, [showPrompt]);

  return {
    // State for the prompt modal
    promptState,
    
    // Control functions
    showPrompt,
    confirmPrompt,
    cancelPrompt,
    setPromptLoading,
    
    // Convenience methods
    promptPassword,
    promptEmail
  };
}

export default usePrompt;
