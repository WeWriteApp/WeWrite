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
}

function EmailVerificationAlert({ className = "" }: EmailVerificationAlertProps) {
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
    if (!auth.currentUser) return;

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
  };

  return (
    <Alert className={`border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/30 ${className}`}>
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex items-center justify-between w-full">
        <div className="flex-1">
          <span className="font-medium text-amber-800 dark:text-amber-200">
            Email verification required
          </span>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Please verify your email so we know you're human!
          </p>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResendVerification}
            disabled={isResending || cooldownRemaining > 0}
            className="bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/50"
          >
            {cooldownRemaining > 0 ? (
              <>
                <Clock className="h-4 w-4 mr-1" />
                {cooldownRemaining > 60
                  ? `${Math.ceil(cooldownRemaining / 60)}m ${cooldownRemaining % 60}s`
                  : `${cooldownRemaining}s`
                }
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-1" />
                {isResending ? 'Sending...' : 'Resend email'}
              </>
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export default EmailVerificationAlert;
