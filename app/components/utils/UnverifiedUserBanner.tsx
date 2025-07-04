"use client";

import React, { useState } from 'react';
import { X, Mail, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';

import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { auth } from '../../firebase/config';
import { sendEmailVerification } from 'firebase/auth';
import { toast } from '../ui/use-toast';

interface UnverifiedUserBannerProps {
  onDismiss?: () => void;
}

function UnverifiedUserBanner({ onDismiss }: UnverifiedUserBannerProps) {
  
  const { session, isAuthenticated } = useCurrentAccount();
  const [isResending, setIsResending] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Only show banner for authenticated users with unverified emails
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

    setIsResending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      toast({
        title: "Verification email sent",
        description: "Please check your email and click the verification link.",
        variant: "default"
      });
    } catch (error) {
      console.error('Error sending verification email:', error);
      toast({
        title: "Error",
        description: "Failed to send verification email. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Email verification required
              </p>
              <div className="flex items-center space-x-4 mt-1">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Please verify your email so we know you're human!
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResendVerification}
              disabled={isResending}
              className="bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/50"
            >
              <Mail className="h-4 w-4 mr-1" />
              {isResending ? 'Sending...' : 'Resend email'}
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
        </div>
      </div>
    </div>
  );
}

export default UnverifiedUserBanner;