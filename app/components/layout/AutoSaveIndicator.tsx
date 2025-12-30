"use client";

import React, { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface AutoSaveIndicatorProps {
  status: SaveStatus;
  lastSavedAt: Date | null;
  error?: string | null;
  className?: string;
}

/**
 * AutoSaveIndicator Component
 *
 * Shows the current auto-save status with simple visual feedback:
 * - Idle: Hidden (no indicator shown) unless saved before
 * - Pending: Shows "Unsaved changes" (user is typing, changes not yet queued)
 * - Saving: Shows "Saving changes" with spinner
 * - Saved: Shows "Changes automatically saved" with checkmark
 * - Error: Shows error state
 */
export default function AutoSaveIndicator({
  status,
  lastSavedAt,
  error,
  className = ""
}: AutoSaveIndicatorProps) {
  const [showCheckmark, setShowCheckmark] = useState(false);

  // Trigger checkmark animation when save completes
  useEffect(() => {
    if (status === 'saved') {
      setShowCheckmark(true);
      // Keep checkmark visible for a bit, then transition to static icon
      const timer = setTimeout(() => {
        setShowCheckmark(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status, lastSavedAt]);

  // Don't show anything if idle and never saved
  if (status === 'idle' && !lastSavedAt) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1.5 text-xs ${className}`}>
      {status === 'pending' && (
        <>
          <Icon name="Circle" size={14} className="text-amber-500" />
          <span className="text-muted-foreground">Unsaved changes</span>
        </>
      )}

      {status === 'saving' && (
        <>
          <Icon name="Loader" size={14} className="text-muted-foreground" />
          <span className="text-muted-foreground">Saving changes</span>
        </>
      )}

      {status === 'saved' && (
        <>
          {showCheckmark ? (
            <div className="relative">
              {/* Animated checkmark with circle */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="text-green-500"
              >
                {/* Circle that draws in */}
                <circle
                  cx="8"
                  cy="8"
                  r="7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="44"
                  strokeDashoffset="44"
                  className="animate-[draw-circle_0.3s_ease-out_forwards]"
                />
                {/* Checkmark that draws in after circle */}
                <path
                  d="M5 8 L7 10 L11 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="10"
                  strokeDashoffset="10"
                  className="animate-[draw-check_0.2s_ease-out_0.3s_forwards]"
                />
              </svg>
            </div>
          ) : (
            <Icon name="Check" size={14} className="text-green-500" />
          )}
          <span className="text-muted-foreground">Changes automatically saved</span>
        </>
      )}

      {status === 'error' && (
        <>
          <Icon name="AlertTriangle" size={14} className="text-destructive" />
          <span className="text-destructive">
            {error || 'Save failed'}
          </span>
        </>
      )}

      {/* Show saved message when idle but have saved before */}
      {status === 'idle' && lastSavedAt && (
        <>
          <Icon name="Check" size={14} className="text-green-500/70" />
          <span className="text-muted-foreground/70">Changes automatically saved</span>
        </>
      )}
    </div>
  );
}
