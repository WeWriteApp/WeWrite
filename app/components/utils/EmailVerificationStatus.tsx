"use client";

import React from 'react';
import { CheckCircle, XCircle, Clock, Mail } from 'lucide-react';
import { StatusIcon } from '../ui/status-icon';
import { useAuth } from '../../providers/AuthProvider';
import { useEmailVerificationStatus } from '../../hooks/useEmailVerificationStatus';
import { Button } from '../ui/button';

interface EmailVerificationStatusProps {
  className?: string;
}

export function EmailVerificationStatus({ className = "" }: EmailVerificationStatusProps) {
  const { user } = useAuth();
  const emailVerificationStatus = useEmailVerificationStatus();

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

  const handleResendEmail = async () => {
    if (!user) return;

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
    }
  };

  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md border ${config.bgColor} ${config.borderColor} ${className}`}>
      <div className="flex items-center gap-2">
        <span className={config.iconColor}>
          {config.icon}
        </span>
        <span className={`text-sm font-medium ${config.textColor}`}>
          {config.text}
        </span>
      </div>
      {config.showAction && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResendEmail}
          className="h-7 px-2 text-xs text-warning hover:text-warning hover:bg-warning/10"
        >
          <Mail className="h-3 w-3 mr-1" />
          Resend
        </Button>
      )}
    </div>
  );
}