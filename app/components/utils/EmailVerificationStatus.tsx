"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { StatusIcon } from '../ui/status-icon';
import { useAuth } from '../../providers/AuthProvider';
import { useEmailVerificationStatus } from '../../hooks/useEmailVerificationStatus';
import { Button } from '../ui/button';

interface EmailVerificationStatusProps {
  className?: string;
}

export function EmailVerificationStatus({ className = "" }: EmailVerificationStatusProps) {
  const { user, refreshUser } = useAuth();
  const emailVerificationStatus = useEmailVerificationStatus();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Show verified only when actually verified AND not in admin testing mode
  const showAsVerified = user?.emailVerified && !emailVerificationStatus.isAdminTestingMode;

  const getStatusConfig = () => {
    if (showAsVerified) {
      return {
        icon: <StatusIcon status="success" size="sm" position="static" />,
        text: "Email verified",
        bgColor: "bg-success/10 dark:bg-success/20",
        borderColor: "border-theme-medium",
        textColor: "text-success dark:text-success-foreground",
        iconColor: "text-success dark:text-success-foreground",
        showAction: false
      };
    }

    return {
      icon: <StatusIcon status="warning" size="sm" position="static" />,
      text: "Email not verified",
      bgColor: "bg-warning/10 dark:bg-warning/20",
      borderColor: "border-warning/30",
      textColor: "text-warning dark:text-warning",
      iconColor: "text-warning dark:text-warning",
      showAction: true
    };
  };

  const config = getStatusConfig();

  const handleRefresh = async () => {
    if (!user || isRefreshing) return;

    setIsRefreshing(true);
    try {
      // Force refresh the Firebase auth token to get the latest emailVerified status
      const { auth } = await import('../../firebase/config');
      await auth.currentUser?.reload();

      // Also call refreshUser if available from AuthProvider
      if (refreshUser) {
        await refreshUser();
      }

      // Force a re-render by triggering the hook update
      window.dispatchEvent(new CustomEvent('bannerOverrideChange'));

      // Check if now verified
      const nowVerified = auth.currentUser?.emailVerified;
      if (nowVerified) {
        // Clear the modal dismissed flag since user is now verified
        localStorage.removeItem('wewrite_email_verification_dismissed');
        window.dispatchEvent(new CustomEvent('bannerOverrideChange'));
      }
    } catch (error) {
      console.error("Error refreshing verification status:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleResendEmail = async () => {
    if (!user || isResending) return;

    setIsResending(true);
    try {
      const { auth } = await import('../../firebase/config');
      const idToken = await auth.currentUser?.getIdToken();

      const response = await fetch("/api/email/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          userId: user.uid,
          username: user.username,
          idToken,
        }),
      });

      if (response.ok) {
        alert('Verification email sent! Check your inbox.');
      } else {
        alert('Failed to send verification email. Please try again.');
      }
    } catch (error) {
      console.error("Error resending verification email:", error);
      alert('Failed to send verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 rounded-md border ${config.bgColor} ${config.borderColor} ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`${config.iconColor} shrink-0`}>
          {config.icon}
        </span>
        <span className={`text-sm font-medium ${config.textColor} whitespace-nowrap`}>
          {config.text}
        </span>
      </div>
      {config.showAction && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-7 px-2 text-xs text-warning hover:text-warning hover:bg-warning/10"
            title="Check if your email has been verified"
          >
            <Icon name={isRefreshing ? "Loader" : "RefreshCw"} size={12} className="mr-1" />
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResendEmail}
            disabled={isResending}
            className="h-7 px-2 text-xs text-warning hover:text-warning hover:bg-warning/10"
            title="Send a new verification email"
          >
            <Icon name="Mail" size={12} className={`mr-1 ${isResending ? 'opacity-50' : ''}`} />
            Resend
          </Button>
        </div>
      )}
    </div>
  );
}