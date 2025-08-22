import { useState, useCallback, useMemo } from 'react';

export type FieldValidator<T = string> = (value: T) => string | null;

export interface UseFormFieldReturn<T = string> {
  value: T;
  error: string | null;
  touched: boolean;
  isValid: boolean;
  isDirty: boolean;
  onChange: (value: T) => void;
  onBlur: () => void;
  reset: () => void;
  validate: () => boolean;
  setError: (error: string | null) => void;
}

/**
 * Hook for managing individual form field state with validation
 * Consolidates the common pattern of field value, error, and validation state
 * 
 * @example
 * ```typescript
 * const titleField = useFormField('', (value) => {
 *   if (!value.trim()) return 'Title is required';
 *   if (value.length > 100) return 'Title must be less than 100 characters';
 *   return null;
 * });
 * 
 * return (
 *   <input
 *     value={titleField.value}
 *     onChange={(e) => titleField.onChange(e.target.value)}
 *     onBlur={titleField.onBlur}
 *     className={titleField.error ? 'border-red-500' : ''}
 *   />
 * );
 * ```
 */
export function useFormField<T = string>(
  initialValue: T,
  validator?: FieldValidator<T>
): UseFormFieldReturn<T> {
  const [value, setValue] = useState<T>(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const isDirty = useMemo(() => value !== initialValue, [value, initialValue]);

  const validate = useCallback((val: T = value): boolean => {
    if (validator) {
      const errorMsg = validator(val);
      setError(errorMsg);
      return !errorMsg;
    }
    setError(null);
    return true;
  }, [validator, value]);

  const onChange = useCallback((newValue: T) => {
    setValue(newValue);
    // Clear error when user starts typing (if field was touched)
    if (touched && error) {
      setError(null);
    }
  }, [touched, error]);

  const onBlur = useCallback(() => {
    setTouched(true);
    validate();
  }, [validate]);

  const reset = useCallback(() => {
    setValue(initialValue);
    setError(null);
    setTouched(false);
  }, [initialValue]);

  const isValid = !error;

  return {
    value,
    error,
    touched,
    isValid,
    isDirty,
    onChange,
    onBlur,
    reset,
    validate: () => validate(value),
    setError
  };
}

/**
 * Hook for managing multiple form fields
 * 
 * @example
 * ```typescript
 * const form = useForm({
 *   title: ['', (v) => !v ? 'Required' : null],
 *   email: ['', (v) => !v.includes('@') ? 'Invalid email' : null]
 * });
 * 
 * const handleSubmit = () => {
 *   if (form.isValid) {
 *     console.log(form.values); // { title: '...', email: '...' }
 *   }
 * };
 * ```
 */
export function useForm<T extends Record<string, any>>(
  fieldConfigs: {
    [K in keyof T]: [T[K], FieldValidator<T[K]>?]
  }
) {
  const fields = useMemo(() => {
    const result = {} as {
      [K in keyof T]: UseFormFieldReturn<T[K]>
    };

    for (const [key, [initialValue, validator]] of Object.entries(fieldConfigs)) {
      result[key as keyof T] = useFormField(initialValue, validator);
    }

    return result;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const values = useMemo(() => {
    const result = {} as T;
    for (const [key, field] of Object.entries(fields)) {
      result[key as keyof T] = (field as UseFormFieldReturn).value;
    }
    return result;
  }, [fields]);

  const errors = useMemo(() => {
    const result = {} as Partial<Record<keyof T, string>>;
    for (const [key, field] of Object.entries(fields)) {
      const error = (field as UseFormFieldReturn).error;
      if (error) {
        result[key as keyof T] = error;
      }
    }
    return result;
  }, [fields]);

  const isValid = useMemo(() => {
    return Object.values(fields).every((field: any) => field.isValid);
  }, [fields]);

  const isDirty = useMemo(() => {
    return Object.values(fields).some((field: any) => field.isDirty);
  }, [fields]);

  const validate = useCallback(() => {
    return Object.values(fields).every((field: any) => field.validate());
  }, [fields]);

  const reset = useCallback(() => {
    Object.values(fields).forEach((field: any) => field.reset());
  }, [fields]);

  return {
    fields,
    values,
    errors,
    isValid,
    isDirty,
    validate,
    reset
  };
}

/**
 * Common validators for form fields
 */
export const validators = {
  required: (message = 'This field is required'): FieldValidator => 
    (value) => !value || (typeof value === 'string' && !value.trim()) ? message : null,

  minLength: (min: number, message?: string): FieldValidator => 
    (value) => typeof value === 'string' && value.length < min 
      ? message || `Must be at least ${min} characters` 
      : null,

  maxLength: (max: number, message?: string): FieldValidator => 
    (value) => typeof value === 'string' && value.length > max 
      ? message || `Must be no more than ${max} characters` 
      : null,

  email: (message = 'Please enter a valid email'): FieldValidator => 
    (value) => typeof value === 'string' && value && !value.includes('@') ? message : null,

  url: (message = 'Please enter a valid URL'): FieldValidator => 
    (value) => {
      if (!value || typeof value !== 'string') return null;
      try {
        new URL(value);
        return null;
      } catch {
        return message;
      }
    },

  combine: (...validators: FieldValidator[]): FieldValidator => 
    (value) => {
      for (const validator of validators) {
        const error = validator(value);
        if (error) return error;
      }
      return null;
    }
};
