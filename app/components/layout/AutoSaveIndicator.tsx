"use client";

import React, { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '../../lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface AutoSaveIndicatorProps {
  status: SaveStatus;
  lastSavedAt: Date | null;
  error?: string | null;
  className?: string;
}

/**
 * AutoSaveIndicator Component
 *
 * Shows the current auto-save status with smooth animated transitions:
 * - Idle: Hidden (no indicator shown) unless saved before
 * - Pending: Shows "Unsaved changes" with pulsing dot
 * - Saving: Shows "Saving" with animated dots
 * - Saved: Shows "Saved" with checkmark
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

  // Animation variants for smooth transitions
  const containerVariants = {
    initial: { opacity: 0, y: -4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 4 }
  };

  return (
    <div className={cn("flex items-center gap-1.5 text-xs h-5 overflow-visible", className)}>
      <AnimatePresence mode="wait">
        {status === 'pending' && (
          <motion.div
            key="pending"
            variants={containerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex items-center gap-1.5"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="text-muted-foreground">Unsaved changes</span>
          </motion.div>
        )}

        {status === 'saving' && (
          <motion.div
            key="saving"
            variants={containerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex items-center gap-1.5"
          >
            <span className="flex items-center gap-0.5">
              <span className="h-1 w-1 rounded-full bg-muted-foreground animate-[pulse_1s_ease-in-out_infinite]"></span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground animate-[pulse_1s_ease-in-out_0.2s_infinite]"></span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground animate-[pulse_1s_ease-in-out_0.4s_infinite]"></span>
            </span>
            <span className="text-muted-foreground">Saving</span>
          </motion.div>
        )}

        {status === 'saved' && (
          <motion.div
            key="saved"
            variants={containerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex items-center gap-1.5"
          >
            {showCheckmark ? (
              <div className="relative">
                {/* Animated checkmark with circle */}
                <svg
                  width="14"
                  height="14"
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
            <span className="text-muted-foreground">Saved</span>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            key="error"
            variants={containerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex items-center gap-1.5"
          >
            <Icon name="AlertTriangle" size={14} className="text-destructive" />
            <span className="text-destructive">
              {error || 'Save failed'}
            </span>
          </motion.div>
        )}

        {/* Show saved message when idle but have saved before */}
        {status === 'idle' && lastSavedAt && (
          <motion.div
            key="idle-saved"
            variants={containerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex items-center gap-1.5"
          >
            <Icon name="Check" size={14} className="text-green-500/70" />
            <span className="text-muted-foreground/70">Saved</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
