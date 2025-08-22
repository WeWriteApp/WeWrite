import React, { useState, useCallback, useEffect } from 'react';

/**
 * Common async state pattern used across many components
 * Consolidates loading, error, and data state management
 */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface UseAsyncStateReturn<T> extends AsyncState<T> {
  execute: (asyncFn: () => Promise<T>) => Promise<T>;
  setData: (data: T | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/**
 * Hook for managing async operations with loading, error, and data states
 * 
 * @example
 * ```typescript
 * const { data, loading, error, execute } = useAsyncState<User>();
 * 
 * const fetchUser = useCallback(async () => {
 *   return execute(() => api.getUser(userId));
 * }, [userId, execute]);
 * 
 * useEffect(() => {
 *   fetchUser();
 * }, [fetchUser]);
 * ```
 */
export function useAsyncState<T>(initialData: T | null = null): UseAsyncStateReturn<T> {
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (asyncFn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await asyncFn();
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(initialData);
    setLoading(false);
    setError(null);
  }, [initialData]);

  return {
    data,
    loading,
    error,
    execute,
    setData,
    setError,
    reset
  };
}

/**
 * Hook for API calls with automatic execution
 * 
 * @example
 * ```typescript
 * const { data: user, loading, error, refetch } = useApiCall(
 *   () => api.getUser(userId),
 *   [userId] // dependencies
 * );
 * ```
 */
export function useApiCall<T>(
  apiFunction: () => Promise<T>,
  dependencies: React.DependencyList = []
): UseAsyncStateReturn<T> & { refetch: () => Promise<T> } {
  const asyncState = useAsyncState<T>();
  
  const refetch = useCallback(() => {
    return asyncState.execute(apiFunction);
  }, [apiFunction, asyncState.execute]);

  // Auto-execute on mount and dependency changes
  React.useEffect(() => {
    refetch();
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...asyncState,
    refetch
  };
}

/**
 * Hook for form submission with async validation
 * 
 * @example
 * ```typescript
 * const { submit, submitting, submitError } = useAsyncSubmit(
 *   async (formData) => {
 *     await api.saveUser(formData);
 *     toast.success('User saved!');
 *   }
 * );
 * ```
 */
export function useAsyncSubmit<T = any>(
  submitFn: (data: T) => Promise<void>,
  onSuccess?: () => void,
  onError?: (error: string) => void
) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = useCallback(async (data: T) => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      await submitFn(data);
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Submission failed';
      setSubmitError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [submitFn, onSuccess, onError]);

  return {
    submit,
    submitting,
    submitError,
    clearError: () => setSubmitError(null)
  };
}
