/**
 * Unified Form Validation - Consolidates all form validation patterns
 * 
 * Replaces:
 * - TitleValidationInput.tsx (specialized validation)
 * - register-form.tsx validation patterns
 * - Various input validation utilities
 * 
 * Provides:
 * - Single validation component with variant support
 * - Consistent validation UI patterns
 * - Reusable validation logic
 * - Simple, maintainable interface
 */

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Loader2, X, Check, ExternalLink, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

type ValidationType = 'text' | 'email' | 'username' | 'title' | 'password' | 'custom';
type ValidationState = 'idle' | 'checking' | 'valid' | 'invalid' | 'duplicate';

interface ValidationResult {
  isValid: boolean;
  isDuplicate?: boolean;
  message?: string;
  existingItem?: any;
  suggestions?: string[];
}

interface ValidationRule {
  type: ValidationType;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: string) => Promise<ValidationResult>;
  debounceMs?: number;
}

interface UnifiedFormValidationProps {
  // Input props
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  inputType?: 'text' | 'password' | 'email';
  
  // Validation props
  validation: ValidationRule;
  onValidationChange?: (result: ValidationResult) => void;
  
  // UI props
  showSuccessState?: boolean;
  showValidationIcon?: boolean;
  showValidationMessage?: boolean;
  
  // Special props for duplicates
  onGoToExisting?: (item: any) => void;
  excludeId?: string; // For editing existing items
}

/**
 * Unified Form Validation Component
 * 
 * Handles all form validation patterns with a single, consistent interface.
 * Automatically determines validation behavior based on type.
 */
export function UnifiedFormValidation({
  value,
  onChange,
  label,
  placeholder,
  className,
  disabled = false,
  inputType = 'text',
  validation,
  onValidationChange,
  showSuccessState = false,
  showValidationIcon = true,
  showValidationMessage = true,
  onGoToExisting,
  excludeId
}: UnifiedFormValidationProps) {
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Built-in validation patterns
  const getBuiltInValidator = (type: ValidationType): ((value: string) => Promise<ValidationResult>) => {
    switch (type) {
      case 'email':
        return async (value: string) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return {
            isValid: emailRegex.test(value),
            message: emailRegex.test(value) ? undefined : 'Please enter a valid email address'
          };
        };

      case 'username':
        return async (value: string) => {
          if (value.length < 3) {
            return { isValid: false, message: 'Username must be at least 3 characters' };
          }
          if (/\s/.test(value)) {
            return { isValid: false, message: 'Username cannot contain spaces' };
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
            return { isValid: false, message: 'Username can only contain letters, numbers, underscores, and hyphens' };
          }
          
          // Check availability (would need API call)
          // For now, just return valid
          return { isValid: true };
        };

      case 'title':
        return async (value: string) => {
          if (value.trim().length === 0) {
            return { isValid: false, message: 'Title is required' };
          }
          if (value.length > 100) {
            return { isValid: false, message: 'Title must be less than 100 characters' };
          }
          
          // Check for duplicates (would need API call)
          // For now, just return valid
          return { isValid: true };
        };

      case 'password':
        return async (value: string) => {
          if (value.length < 6) {
            return { isValid: false, message: 'Password must be at least 6 characters' };
          }
          return { isValid: true };
        };

      case 'text':
      default:
        return async (value: string) => {
          const minLength = validation.minLength || 0;
          const maxLength = validation.maxLength || 1000;
          
          if (validation.required && value.trim().length === 0) {
            return { isValid: false, message: 'This field is required' };
          }
          if (value.length < minLength) {
            return { isValid: false, message: `Must be at least ${minLength} characters` };
          }
          if (value.length > maxLength) {
            return { isValid: false, message: `Must be no more than ${maxLength} characters` };
          }
          if (validation.pattern && !validation.pattern.test(value)) {
            return { isValid: false, message: 'Invalid format' };
          }
          
          return { isValid: true };
        };
    }
  };

  // Debounced validation function
  const debouncedValidate = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout | null = null;

      return (valueToCheck: string) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Don't validate empty values unless required
        if (!valueToCheck.trim() && !validation.required) {
          setValidationState('idle');
          setValidationResult(null);
          onValidationChange?.({ isValid: true });
          return;
        }

        setValidationState('checking');

        timeoutId = setTimeout(async () => {
          try {
            const validator = validation.customValidator || getBuiltInValidator(validation.type);
            const result = await validator(valueToCheck);
            
            setValidationResult(result);
            
            if (result.isDuplicate) {
              setValidationState('duplicate');
            } else if (result.isValid) {
              setValidationState('valid');
            } else {
              setValidationState('invalid');
            }
            
            onValidationChange?.(result);
          } catch (error) {
            console.error('Validation error:', error);
            const errorResult = { 
              isValid: false, 
              message: 'Validation failed. Please try again.' 
            };
            setValidationResult(errorResult);
            setValidationState('invalid');
            onValidationChange?.(errorResult);
          }
        }, validation.debounceMs || 500);
      };
    })(),
    [validation, onValidationChange]
  );

  // Trigger validation when value changes
  useEffect(() => {
    debouncedValidate(value);
  }, [value, debouncedValidate]);

  const getValidationIcon = () => {
    if (!showValidationIcon) return null;

    switch (validationState) {
      case 'checking':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'valid':
        return showSuccessState ? <Check className="h-4 w-4 text-green-500" /> : null;
      case 'invalid':
      case 'duplicate':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getInputClassName = () => {
    const baseClasses = cn("pr-10", className);
    
    if (validationState === 'checking') return baseClasses;
    
    if (showSuccessState && validationState === 'valid') {
      return cn(baseClasses, "border-success focus-visible:ring-success");
    }

    if (validationState === 'invalid' || validationState === 'duplicate') {
      return cn(baseClasses, "border-destructive focus-visible:ring-destructive");
    }
    
    return baseClasses;
  };

  const renderValidationMessage = () => {
    if (!showValidationMessage || !validationResult?.message) return null;

    if (validationState === 'duplicate' && validationResult.existingItem && onGoToExisting) {
      return (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                {validationResult.message}
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                Want to go there instead?
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onGoToExisting(validationResult.existingItem)}
              className="text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 p-1 h-auto"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      );
    }

    if (validationState === 'invalid') {
      return (
        <div className="flex items-start gap-2 p-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{validationResult.message}</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label 
          htmlFor={`validation-input-${validation.type}`}
          className={cn(
            "text-sm font-medium",
            validationState === 'invalid' || validationState === 'duplicate' 
              ? "text-red-600 dark:text-red-400" 
              : ""
          )}
        >
          {label}
          {validation.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      
      <div className="relative">
        <Input
          id={`validation-input-${validation.type}`}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={getInputClassName()}
        />
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {getValidationIcon()}
        </div>
      </div>

      {renderValidationMessage()}
    </div>
  );
}

// Convenience wrapper components for common use cases
export function EmailValidationInput(props: Omit<UnifiedFormValidationProps, 'validation'>) {
  return (
    <UnifiedFormValidation
      {...props}
      validation={{ type: 'email', required: true }}
      inputType="email"
    />
  );
}

export function UsernameValidationInput(props: Omit<UnifiedFormValidationProps, 'validation'>) {
  return (
    <UnifiedFormValidation
      {...props}
      validation={{ type: 'username', required: true, minLength: 3, maxLength: 30 }}
    />
  );
}

export function TitleValidationInput(props: Omit<UnifiedFormValidationProps, 'validation'>) {
  return (
    <UnifiedFormValidation
      {...props}
      validation={{ type: 'title', required: true, maxLength: 100 }}
    />
  );
}

export function PasswordValidationInput(props: Omit<UnifiedFormValidationProps, 'validation'>) {
  return (
    <UnifiedFormValidation
      {...props}
      validation={{ type: 'password', required: true, minLength: 6 }}
      inputType="password"
      showSuccessState={true}
    />
  );
}

export default UnifiedFormValidation;
