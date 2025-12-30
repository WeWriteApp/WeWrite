"use client";

import React from 'react';
import { Icon, IconName } from '@/components/ui/Icon';
import { Button } from './button';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  /** Icon to display (optional - omit to hide icon) */
  icon?: IconName;
  title: string;
  description?: string;
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Action button config (optional - omit to hide button) */
  action?: {
    label: string;
    onClick: () => void;
    /** Use 'default' for primary button, 'outline' for secondary */
    variant?: 'default' | 'outline';
  };
}

const sizeConfig = {
  sm: {
    padding: 'p-3',
    iconSize: 24,
    titleClass: 'text-sm font-medium mb-0.5',
    descClass: 'text-xs',
    iconMargin: 'mb-2',
  },
  md: {
    padding: 'p-4',
    iconSize: 32,
    titleClass: 'text-base font-medium mb-1',
    descClass: 'text-sm',
    iconMargin: 'mb-3',
  },
  lg: {
    padding: 'p-6',
    iconSize: 40,
    titleClass: 'text-lg font-medium mb-2',
    descClass: 'text-base',
    iconMargin: 'mb-4',
  },
};

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
  size = 'md',
  action
}: EmptyStateProps) {
  const config = sizeConfig[size];

  return (
    <div className={cn(
      "empty-state-border bg-transparent rounded-xl",
      config.padding,
      "text-center text-muted-foreground",
      className
    )}>
      {icon && (
        <Icon name={icon} size={config.iconSize} className={cn("mx-auto opacity-50", config.iconMargin)} />
      )}
      <h3 className={config.titleClass}>
        {title}
      </h3>
      {description && (
        <p className={config.descClass}>
          {description}
        </p>
      )}
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
