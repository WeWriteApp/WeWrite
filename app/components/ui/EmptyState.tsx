"use client";

import React from 'react';
import { Icon, IconName } from '@/components/ui/Icon';
import { Button } from './button';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  /** Icon to display (optional - omit to hide icon) */
  icon?: IconName;
  title: string;
  description: string;
  className?: string;
  /** Action button config (optional - omit to hide button) */
  action?: {
    label: string;
    onClick: () => void;
    /** Use 'default' for primary button, 'outline' for secondary */
    variant?: 'default' | 'outline';
  };
}

/**
 * Standardized Empty State Component
 *
 * Simple empty state with dotted border, optional icon, and optional action button.
 */
export default function EmptyState({
  icon,
  title,
  description,
  className,
  action
}: EmptyStateProps) {
  return (
    <div className={cn(
      "empty-state-border bg-transparent rounded-xl p-4",
      "text-center text-muted-foreground",
      className
    )}>
      {icon && (
        <Icon name={icon} size={32} className="mx-auto opacity-50 mb-3" />
      )}
      <h3 className="text-base font-medium mb-1">
        {title}
      </h3>
      <p className="text-sm">
        {description}
      </p>
      {action && (
        <Button
          variant={action.variant || 'default'}
          onClick={action.onClick}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
