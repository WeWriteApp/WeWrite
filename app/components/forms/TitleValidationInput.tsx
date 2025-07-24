"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '../ui/input';
import { Loader2, X, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';
import { validateTitleForDuplicates } from '../../utils/duplicateTitleValidation';
import { useRouter } from 'next/navigation';

interface TitleValidationInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  excludePageId?: string; // For editing existing pages
  disabled?: boolean;
  onValidationChange?: (isValid: boolean, isDuplicate: boolean) => void;
}

export function TitleValidationInput({
  value,
  onChange,
  placeholder = "Enter page title",
  className,
  excludePageId,
  disabled = false,
  onValidationChange
}: TitleValidationInputProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validationMessage, setValidationMessage] = useState<string>("");

  // Debounced validation function
  const debouncedValidate = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout | null = null;

      return (titleToCheck: string) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(async () => {
          if (!titleToCheck || titleToCheck.trim() === '') {
            setValidationResult(null);
            setValidationMessage("");
            setIsChecking(false);
            onValidationChange?.(true, false);
            return;
          }

          setIsChecking(true);
          
          try {
            console.log('🔍 TITLE_VALIDATION: Checking title:', titleToCheck.trim());
            
            const result = await validateTitleForDuplicates(titleToCheck.trim(), excludePageId);
            
            console.log('🔍 TITLE_VALIDATION: Result:', result);
            setValidationResult(result);

            if (result.isDuplicate && result.existingPage) {
              setValidationMessage(`You already have a page called "${result.existingPage.title}"`);
              onValidationChange?.(false, true);
            } else if (result.error) {
              setValidationMessage(result.message || "Error checking title");
              onValidationChange?.(false, false);
            } else {
              setValidationMessage(""); // Clear message for valid titles
              onValidationChange?.(true, false);
            }
          } catch (error) {
            console.error('🔴 TITLE_VALIDATION: Error:', error);
            setValidationResult({ isValid: false, error: 'CHECK_FAILED' });
            setValidationMessage("Could not verify title. Please try again.");
            onValidationChange?.(false, false);
          } finally {
            setIsChecking(false);
          }
        }, 500); // 500ms debounce
      };
    })(),
    [excludePageId, onValidationChange]
  );

  // Trigger validation when value changes
  useEffect(() => {
    debouncedValidate(value);
  }, [value, debouncedValidate]);

  const handleGoToExistingPage = () => {
    if (validationResult?.existingPage?.id) {
      router.push(`/${validationResult.existingPage.id}`);
    }
  };

  const isDuplicate = validationResult?.isDuplicate;
  const isValid = validationResult?.isValid;
  const hasValue = value && value.trim() !== '';

  return (
    <div className="space-y-2">
      {/* Title Input */}
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "pr-10",
            className,
            // Only show red border for errors, no green border for success
            hasValue && !isChecking && isDuplicate && "border-red-500"
          )}
        />
        
        {/* Validation Icon - Only show error states, no success states */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isChecking ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : hasValue && isDuplicate ? (
            <X className="h-4 w-4 text-red-500" />
          ) : null}
        </div>
      </div>

      {/* Validation Messages - Only show error states */}
      {hasValue && !isChecking && validationResult && validationMessage && (
        <div className="space-y-2">
          {isDuplicate && validationResult.existingPage ? (
            // Duplicate title message with link
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                    {validationMessage}
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                    Want to go there instead?
                  </p>
                </div>
                <button
                  onClick={handleGoToExistingPage}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Go to page
                </button>
              </div>
            </div>
          ) : validationResult.error ? (
            // Error message
            <div className="p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {validationMessage}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
