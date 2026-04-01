import { useState, useCallback } from 'react';

/**
 * Return type for a managed form field.
 */
export interface UseFormFieldReturn {
  value: string;
  error: string | null;
  touched: boolean;
  isValid: boolean;
  onChange: (newValue: string) => void;
  onBlur: () => void;
  reset: () => void;
  setError: (error: string | null) => void;
}

/**
 * Hook for managing a single form field with value, validation, and error state.
 *
 * Found in 8+ forms: `title`, `email`, `password`, `username` each need
 * value + error + touched state.  This hook consolidates the repeated pattern.
 *
 * @example
 * ```typescript
 * const titleField = useFormField('', (v) => v.trim() ? null : 'Title is required');
 *
 * <input
 *   value={titleField.value}
 *   onChange={(e) => titleField.onChange(e.target.value)}
 *   onBlur={titleField.onBlur}
 * />
 * {titleField.error && <span>{titleField.error}</span>}
 * ```
 */
export function useFormField(
  initialValue: string = '',
  validator?: (value: string) => string | null
): UseFormFieldReturn {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const validate = useCallback(
    (val: string): boolean => {
      if (!validator) return true;
      const errorMsg = validator(val);
      setError(errorMsg);
      return !errorMsg;
    },
    [validator]
  );

  const onChange = useCallback(
    (newValue: string) => {
      setValue(newValue);
      // Only re-validate while the field has already been touched
      if (touched) validate(newValue);
    },
    [touched, validate]
  );

  const onBlur = useCallback(() => {
    setTouched(true);
    validate(value);
  }, [value, validate]);

  const reset = useCallback(() => {
    setValue(initialValue);
    setError(null);
    setTouched(false);
  }, [initialValue]);

  return {
    value,
    error,
    touched,
    isValid: !error,
    onChange,
    onBlur,
    reset,
    setError,
  };
}
