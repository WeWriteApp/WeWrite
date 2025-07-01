"use client";

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';
import { toast } from './use-toast';

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'outline';
}

/**
 * A standalone copy button component that can be used anywhere
 * This avoids the issues with ToastAction and provides a more flexible solution
 */
export function CopyButton({ 
  text, 
  className = '', 
  size = 'sm',
  variant = 'outline'
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!text || typeof text !== 'string' || !text.trim()) {
      console.warn('CopyButton: No valid text to copy');
      return;
    }

    try {
      const success = await copyToClipboard(text);
      if (success) {
        setCopied(true);
        // Show success feedback without copy button to avoid recursion
        toast({
          title: "Copied to clipboard",
          variant: "success",
          duration: 2000});
        
        // Reset copied state after 2 seconds
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Show error feedback without copy button
        toast({
          title: "Failed to copy",
          description: "Please try selecting and copying the text manually",
          variant: "destructive",
          duration: 3000});
      }
    } catch (error) {
      console.error('Error copying text:', error);
      toast({
        title: "Copy failed",
        description: "An error occurred while copying",
        variant: "destructive",
        duration: 3000});
    }
  };

  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base'
  };

  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
  };

  const iconSize = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <button
      onClick={handleCopy}
      className={`
        inline-flex items-center justify-center rounded-md font-medium 
        ring-offset-background transition-colors 
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 
        disabled:pointer-events-none disabled:opacity-50
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
      type="button"
      title={copied ? "Copied!" : "Copy to clipboard"}
      disabled={!text || !text.trim()}
    >
      {copied ? (
        <Check className={`${iconSize[size]} text-green-600`} />
      ) : (
        <Copy className={iconSize[size]} />
      )}
    </button>
  );
}

/**
 * A copy button specifically styled for use in error contexts
 */
export function ErrorCopyButton({ text, className = '' }: { text: string; className?: string }) {
  return (
    <CopyButton
      text={text}
      size="sm"
      variant="ghost"
      className={`ml-2 text-destructive-foreground hover:text-destructive-foreground/80 ${className}`}
    />
  );
}