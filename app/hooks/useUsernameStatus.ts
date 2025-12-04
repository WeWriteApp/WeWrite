"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';

/**
 * Hook to check if the current user has a valid username set
 * 
 * Returns:
 * - needsUsername: true if user needs to set up their username
 * - isLoading: true while checking username status
 * - username: the current username (if valid) or null
 */
export function useUsernameStatus() {
  const { user, isLoading: authLoading } = useAuth();
  const [needsUsername, setNeedsUsername] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setNeedsUsername(false);
      setIsLoading(false);
      setUsername(null);
      return;
    }

    // Check if the user's username is valid
    const currentUsername = user.username || '';
    const isValid = isValidUsername(currentUsername);

    setNeedsUsername(!isValid);
    setUsername(isValid ? currentUsername : null);
    setIsLoading(false);
  }, [user, authLoading]);

  return { needsUsername, isLoading, username };
}

/**
 * Check if a username is valid (not auto-generated or email-based)
 */
export function isValidUsername(username: string | null | undefined): boolean {
  if (!username || typeof username !== 'string') return false;
  
  const trimmed = username.trim();
  
  // Empty is invalid
  if (!trimmed) return false;
  
  // Email addresses are invalid
  if (trimmed.includes('@')) return false;
  
  // Auto-generated fallbacks are invalid (user_XXXXXXXX pattern)
  if (/^user_[a-zA-Z0-9]{6,12}$/i.test(trimmed)) return false;
  
  // "User XXXXXXXX" pattern is invalid
  if (/^User [a-zA-Z0-9]{6,12}$/i.test(trimmed)) return false;
  
  // "Anonymous" or placeholder values
  const invalidValues = ['anonymous', 'loading...', 'missing username', 'unknown', 'guest'];
  if (invalidValues.includes(trimmed.toLowerCase())) return false;
  
  return true;
}
