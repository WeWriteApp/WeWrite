"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";

/**
 * Offline Fallback Page
 *
 * Displayed when the user is offline and the requested page is not cached.
 * Uses minimal dependencies to ensure it works even with limited caching.
 */
export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-retry when back online
      handleRetry();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setIsRetrying(true);
    // Small delay to show loading state
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full wewrite-card p-8 rounded-lg shadow-lg text-center">
        {/* Offline Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
            <Icon
              name="WifiOff"
              size={40}
              className="text-muted-foreground"
            />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold mb-3">You're offline</h1>

        {/* Message */}
        <p className="text-muted-foreground mb-8">
          Check your internet connection and try again.
        </p>

        {/* Status indicator */}
        {isOnline && (
          <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 mb-4">
            <Icon name="Wifi" size={16} />
            <span className="text-sm">Connection restored</span>
          </div>
        )}

        {/* Retry Button */}
        <Button
          size="lg"
          className="gap-2 w-full"
          onClick={handleRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <>
              <Icon name="Loader" size={20} />
              Retrying...
            </>
          ) : (
            <>
              <Icon name="RefreshCw" size={20} />
              Try again
            </>
          )}
        </Button>

        {/* Noscript fallback */}
        <noscript>
          <p className="mt-4 text-sm text-muted-foreground">
            Please check your internet connection and refresh this page.
          </p>
        </noscript>
      </div>
    </div>
  );
}
