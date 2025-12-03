import { useState, useEffect } from 'react';

/**
 * Custom hook for debouncing values
 * Useful for preventing excessive API calls or expensive computations
 * 
 * @param value - The value to debounce
 * @param delay - The debounce delay in milliseconds
 * @returns The debounced value
 * 
 * @example
 * const debouncedSearchTerm = useDebounce(searchTerm, 300);
 * useEffect(() => {
 *   // This will only run 300ms after the user stops typing
 *   search(debouncedSearchTerm);
 * }, [debouncedSearchTerm]);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
