"use client";

import React from 'react';
import { Button } from './button';
import { Copy, Check } from 'lucide-react';
import { useClipboard } from '../../hooks/useClipboard';

interface CopyErrorButtonProps {
  error: Error | string;
  errorInfo?: React.ErrorInfo;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
}

export function CopyErrorButton({ 
  error, 
  errorInfo, 
  className = "", 
  size = "sm",
  variant = "outline"
}: CopyErrorButtonProps) {
  const { copied, copyToClipboard } = useClipboard();

  const handleCopyError = async () => {
    let errorText = '';
    
    // Format the error information
    if (error instanceof Error) {
      errorText += `Error: ${error.name}\n`;
      errorText += `Message: ${error.message}\n`;
      if (error.stack) {
        errorText += `Stack Trace:\n${error.stack}\n`;
      }
    } else if (typeof error === 'string') {
      errorText += `Error: ${error}\n`;
    }
    
    // Add React error info if available
    if (errorInfo) {
      errorText += `\nComponent Stack:\n${errorInfo.componentStack}\n`;
    }
    
    // Add timestamp and browser info
    errorText += `\nTimestamp: ${new Date().toISOString()}\n`;
    errorText += `User Agent: ${navigator.userAgent}\n`;
    errorText += `URL: ${window.location.href}\n`;
    
    const success = await copyToClipboard(errorText);
    if (!success) {
      // Fallback: show alert with error text
      alert('Failed to copy to clipboard. Error details:\n\n' + errorText);
    }
  };

  return (
    <Button
      onClick={handleCopyError}
      size={size}
      variant={variant}
      className={`gap-2 ${className}`}
      disabled={copied}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copy Error
        </>
      )}
    </Button>
  );
}