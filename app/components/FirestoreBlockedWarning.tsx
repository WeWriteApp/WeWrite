"use client";

import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

/**
 * Component to detect and warn users about blocked Firestore connections
 * This can happen when users have ad blockers or privacy extensions enabled
 */
export default function FirestoreBlockedWarning() {
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    // Function to check if Firestore is blocked
    const checkFirestoreConnection = async () => {
      try {
        // Create a test connection to Firestore
        const testUrl = 'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?database=projects%2Fwewrite-ccd82%2Fdatabases%2F(default)&VER=8&RID=1&CVER=22&X-HTTP-Session-Id=gsessionid&$httpHeaders=X-Goog-Api-Client:gl-js/';
        
        // Use fetch with a timeout to check if the connection is blocked
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(testUrl, { 
          method: 'GET',
          signal: controller.signal,
          mode: 'no-cors' // This is needed for cross-origin requests
        });
        
        clearTimeout(timeoutId);
        
        // If we get here, the connection is not blocked
        setIsBlocked(false);
      } catch (error) {
        // If we get an error, the connection might be blocked
        // Check if it's an abort error (timeout) or a network error
        if (error.name === 'AbortError' || error.name === 'TypeError') {
          setIsBlocked(true);
        }
      }
    };

    // Run the check when the component mounts
    checkFirestoreConnection();
  }, []);

  if (!isBlocked) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Connection Issue Detected</AlertTitle>
      <AlertDescription>
        We've detected that connections to our database might be blocked by an ad blocker or privacy extension. 
        This can cause issues with loading content and saving changes. Please consider disabling your ad blocker 
        or adding this site to your allowlist for the best experience.
      </AlertDescription>
    </Alert>
  );
}
