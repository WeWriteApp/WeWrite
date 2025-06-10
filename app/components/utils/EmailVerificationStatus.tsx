"use client";

import React from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { useSyncQueue } from '../../contexts/SyncQueueContext';

interface EmailVerificationStatusProps {
  className?: string;
}

export function EmailVerificationStatus({ className = "" }: EmailVerificationStatusProps) {
  const { isEmailVerified } = useSyncQueue();

  const getStatusConfig = () => {
    if (isEmailVerified) {
      return {
        icon: <CheckCircle className="h-4 w-4" />,
        text: "Email verified",
        bgColor: "bg-green-50 dark:bg-green-950/20",
        borderColor: "border-green-200 dark:border-green-800",
        textColor: "text-green-700 dark:text-green-300",
        iconColor: "text-green-600 dark:text-green-400"
      };
    }

    return {
      icon: <XCircle className="h-4 w-4" />,
      text: "Email not verified",
      bgColor: "bg-red-50 dark:bg-red-950/20",
      borderColor: "border-red-200 dark:border-red-800",
      textColor: "text-red-700 dark:text-red-300",
      iconColor: "text-red-600 dark:text-red-400"
    };
  };

  const config = getStatusConfig();

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border ${config.bgColor} ${config.borderColor} ${className}`}>
      <span className={config.iconColor}>
        {config.icon}
      </span>
      <span className={`text-sm font-medium ${config.textColor}`}>
        {config.text}
      </span>
    </div>
  );
}
