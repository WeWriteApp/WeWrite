"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Loader, Check, X } from 'lucide-react';
import { checkUsernameAvailability, addUsername } from '../../firebase/auth';
import { useAuth } from '../../providers/AuthProvider';
import { cn } from '../../lib/utils';
import { validateUsernameFormat, getUsernameErrorMessage, suggestCleanUsername } from '../../utils/usernameValidation';

export default function UsernameEnforcementModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);

  // Check if the user has a username
  useEffect(() => {
    if (user && (!user.username || user.username === '')) {
      setOpen(true);
    }
  }, [user]);

  // Check username availability with debounce
  useEffect(() => {
    if (!username) {
      setIsAvailable(null);
      setValidationMessage("");
      setValidationError(null);
      setUsernameSuggestions([]);
      return;
    }

    // First, validate format client-side
    const formatValidation = validateUsernameFormat(username);
    if (!formatValidation.isValid) {
      setIsAvailable(false);
      setValidationError(formatValidation.error);
      setValidationMessage(formatValidation.message || "");

      // If it contains whitespace, suggest a cleaned version
      if (formatValidation.error === "CONTAINS_WHITESPACE") {
        const cleanSuggestion = suggestCleanUsername(username);
        if (cleanSuggestion && cleanSuggestion !== username) {
          setUsernameSuggestions([cleanSuggestion]);
        }
      } else {
        setUsernameSuggestions([]);
      }
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      try {
        const result = await checkUsernameAvailability(username);

        if (typeof result === 'boolean') {
          // Handle legacy boolean response
          setIsAvailable(result);
          if (!result) {
            setValidationError("USERNAME_TAKEN");
            setValidationMessage("Username already taken");
          } else {
            setValidationError(null);
            setValidationMessage("");
          }
          setUsernameSuggestions([]);
        } else {
          // Handle new object response
          setIsAvailable(result.isAvailable);
          setValidationMessage(result.message || "");
          setValidationError(result.error || null);

          // Set username suggestions if available
          if (result.suggestions && Array.isArray(result.suggestions)) {
            setUsernameSuggestions(result.suggestions);
          } else {
            setUsernameSuggestions([]);
          }
        }
      } catch (error) {
        console.error('Error checking username availability:', error);
        setIsAvailable(false);
        setValidationMessage("Error checking username availability");
        setValidationError("CHECK_ERROR");
        setUsernameSuggestions([]);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  // Handle clicking on a username suggestion
  const handleSuggestionClick = (suggestion: string) => {
    setUsername(suggestion);
    // Username will be checked by the useEffect
  };

  const handleSave = async () => {
    if (!user || !username || !isAvailable) return;

    setIsSaving(true);
    setError(null);

    try {
      await addUsername(user.uid, username);
      // Success - close modal
      setOpen(false);
    } catch (error) {
      console.error('Error saving username:', error);
      setError('Failed to save username. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Validate username format using the new validation utility
  const formatValidation = validateUsernameFormat(username);
  const isValidFormat = formatValidation.isValid;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col rounded-lg border-theme-strong bg-card animate-in fade-in-0 zoom-in-95 duration-300 px-6 py-6">
        <DialogHeader>
          <DialogTitle>Set Your Username</DialogTitle>
          <DialogDescription>
            You must set a username to continue using WeWrite.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`${!isValidFormat && username.length > 0 ? 'border-red-500' : ''}
                           ${isAvailable === true ? 'border-green-500' : ''}
                           ${isAvailable === false ? 'border-red-500' : ''}`}
              />

              {/* Validation messages */}
              {!isValidFormat && username.length > 0 && (
                <p className="text-sm text-red-500">
                  {formatValidation.message || "Username must be at least 3 characters and contain only letters, numbers, and underscores. Spaces and whitespace characters are not allowed."}
                </p>
              )}

              {isChecking && (
                <p className="text-sm text-muted-foreground flex items-center">
                  <Loader className="h-3 w-3 animate-spin mr-1" />
                  Checking availability...
                </p>
              )}

              {isAvailable === true && !isChecking && (
                <p className="text-sm text-green-500">Username is available!</p>
              )}

              {isAvailable === false && !isChecking && (
                <div className="space-y-2">
                  <p className="text-sm text-red-500">{validationMessage || "Username is already taken."}</p>

                  {/* Username suggestions */}
                  {(validationError === "USERNAME_TAKEN" || validationError === "CONTAINS_WHITESPACE") && usernameSuggestions.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm text-foreground mb-2">
                        {validationError === "CONTAINS_WHITESPACE" ? "Try this instead:" : "Try one of these instead:"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {usernameSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="px-3 py-1.5 text-sm font-medium rounded-md bg-background border border-input hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border dark:border-neutral-700">
          <Button
            onClick={handleSave}
            disabled={!isAvailable || isSaving || !isValidFormat}
            className="w-full"
          >
            {isSaving ? (
              <>
                <Loader className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Username'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
