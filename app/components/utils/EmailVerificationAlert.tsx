"use client";

import React, { useState, useEffect } from 'react';
import { X, Mail, AlertCircle, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { auth } from '../../firebase/config';
import { sendEmailVerification } from 'firebase/auth';
import { toast } from '../ui/use-toast';
import {
  getResendCooldownRemaining,
  canResendVerificationEmail,
  startResendCooldown
} from '../../services/emailVerificationNotifications';

interface EmailVerificationAlertProps {
  className?: string;
  variant?: 'alert' | 'banner';
  onDismiss?: () => void;
}

/**
 * Unified Email Verification Component
 *
 * Supports two variants:
 * - 'alert': Contained alert box (default) - good for in-page notifications
 * - 'banner': Full-width top banner - good for global notifications
 *
 * Mobile optimized with responsive text and button sizing.
 */
function EmailVerificationAlert({
  className = "",
  variant = "alert",
  onDismiss
}: EmailVerificationAlertProps) {
  const { session, isAuthenticated } = useCurrentAccount();
  const [isResending, setIsResending] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Update cooldown timer
  useEffect(() => {
    const updateCooldown = () => {
      setCooldownRemaining(getResendCooldownRemaining());
    };

    // Initial update
    updateCooldown();

    // Update every second while cooldown is active
    const interval = setInterval(updateCooldown, 1000);

    return () => clearInterval(interval);
  }, []);

  // Only show alert for authenticated users with unverified emails
  if (!isAuthenticated || !session || auth.currentUser?.emailVerified || isDismissed) {
    return null;
  }

  const handleResendVerification = async () => {
    if (!auth.currentUser) {
      toast({
        title: "Error",
        description: "No user found. Please log in again.",
        variant: "destructive"
      });
      return;
    }

    if (!canResendVerificationEmail()) {
      return;
    }

    setIsResending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      startResendCooldown();
      setCooldownRemaining(getResendCooldownRemaining());

      toast({
        title: "Verification email sent",
        description: "Please check your email and click the verification link.",
        variant: "default"
      });
    } catch (error: any) {
      console.error("Error sending verification email:", error);
      toast({
        title: "Error",
        description: "Failed to send verification email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Render banner variant (full-width top banner)
  if (variant === 'banner') {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800/30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Mobile-first responsive layout */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 sm:py-3 gap-2 sm:gap-0">
            {/* Content section - stacked on mobile, inline on desktop */}
            <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1">
              <div className="flex-shrink-0 mt-0.5 sm:mt-0">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 leading-tight">
                    Email verification required
                  </p>
                  <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 leading-tight mt-0.5 sm:mt-0">
                    Please verify your email so we know you're human!
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons - compact on mobile, full on desktop */}
            <div className="flex items-center justify-end space-x-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResendVerification}
                disabled={isResending || cooldownRemaining > 0}
                className="bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2 h-auto"
              >
                {cooldownRemaining > 0 ? (
                  <>
                    <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">
                      {cooldownRemaining > 60
                        ? `${Math.ceil(cooldownRemaining / 60)}m ${cooldownRemaining % 60}s`
                        : `${cooldownRemaining}s`
                      }
                    </span>
                    <span className="sm:hidden">
                      {cooldownRemaining > 60
                        ? `${Math.ceil(cooldownRemaining / 60)}m`
                        : `${cooldownRemaining}s`
                      }
                    </span>
                  </>
                ) : (
                  <>
                    <Mail className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">
                      {isResending ? 'Sending...' : 'Resend email'}
                    </span>
                    <span className="sm:hidden">
                      {isResending ? 'Sending...' : 'Resend'}
                    </span>
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30 p-1 sm:p-2 h-auto"
              >
                <X className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render alert variant (contained alert box)
  return (
    <Alert className={`border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/30 ${className}`}>
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-2 sm:gap-4">
        <div className="flex-1 min-w-0">
          <span className="font-medium text-amber-800 dark:text-amber-200 text-sm">
            Email verification required
          </span>
          <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 mt-0.5 sm:mt-1 leading-tight">
            Please verify your email so we know you're human!
          </p>
        </div>

        <div className="flex items-center justify-end space-x-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResendVerification}
            disabled={isResending || cooldownRemaining > 0}
            className="bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2 h-auto"
          >
            {cooldownRemaining > 0 ? (
              <>
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">
                  {cooldownRemaining > 60
                    ? `${Math.ceil(cooldownRemaining / 60)}m ${cooldownRemaining % 60}s`
                    : `${cooldownRemaining}s`
                  }
                </span>
                <span className="sm:hidden">
                  {cooldownRemaining > 60
                    ? `${Math.ceil(cooldownRemaining / 60)}m`
                    : `${cooldownRemaining}s`
                  }
                </span>
              </>
            ) : (
              <>
                <Mail className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">
                  {isResending ? 'Sending...' : 'Resend email'}
                </span>
                <span className="sm:hidden">
                  {isResending ? 'Sending...' : 'Resend'}
                </span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30 p-1 sm:p-2 h-auto"
          >
            <X className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export default EmailVerificationAlert;

// Export aliases for different use cases
export { EmailVerificationAlert as EmailVerificationBanner };
export { EmailVerificationAlert as UnverifiedUserBanner };
