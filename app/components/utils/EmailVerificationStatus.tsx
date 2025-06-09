"use client";

import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { useSyncQueue } from '../../contexts/SyncQueueContext';

interface EmailVerificationStatusProps {
  className?: string;
}

export function EmailVerificationStatus({ className = "" }: EmailVerificationStatusProps) {
  const { isEmailVerified } = useSyncQueue();

  const getVerificationStatusIcon = () => {
    if (isEmailVerified) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getVerificationStatusText = () => {
    if (isEmailVerified) {
      return "Verified";
    }
    return "Unverified";
  };

  const getVerificationStatusColor = () => {
    if (isEmailVerified) {
      return "text-green-600";
    }
    return "text-red-600";
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {getVerificationStatusIcon()}
      <span className={`text-sm font-medium ${getVerificationStatusColor()}`}>
        {getVerificationStatusText()}
      </span>
    </div>
  );
}
