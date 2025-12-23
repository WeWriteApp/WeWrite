"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { Button } from './button';
import { cn } from '../../lib/utils';

interface BackToSettingsButtonProps {
  className?: string;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

/**
 * Standardized "Back to Settings" button for all settings subpages
 * 
 * Features:
 * - Consistent styling with left chevron
 * - Proper navigation to main settings page
 * - Responsive design
 * - Accessible with proper ARIA labels
 */
export function BackToSettingsButton({ 
  className = "",
  variant = "ghost",
  size = "sm"
}: BackToSettingsButtonProps) {
  const router = useRouter();

  const handleBackClick = () => {
    router.push('/settings');
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleBackClick}
      className={cn(
        "flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors",
        "mb-6 -ml-2", // Negative margin to align with content
        className
      )}
      aria-label="Back to Settings"
    >
      <Icon name="ChevronLeft" size={16} />
      <span className="text-sm font-medium">Back to Settings</span>
    </Button>
  );
}

export default BackToSettingsButton;
