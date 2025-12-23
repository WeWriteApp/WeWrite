"use client";

import React from 'react';
import { Icon, IconName } from '@/components/ui/Icon';
import { Button } from './button';
import { cn, wewriteCard } from '../../lib/utils';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost';
}

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /**
   * Variant styling:
   * - 'default': Standard card with background
   * - 'dotted': Blank/transparent background with dotted border
   */
  variant?: 'default' | 'dotted';
  /**
   * Optional action button for "create first item" type flows
   */
  action?: EmptyStateAction;
}

/**
 * Standardized Empty State Component
 *
 * Provides consistent empty states across all homepage sections
 * with optional debug information for development
 */
export default function EmptyState({
  icon: iconName,
  title,
  description,
  className,
  size = 'md',
  variant = 'default',
  action
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: '',
      iconSize: 24,
      title: 'text-sm font-medium',
      description: 'text-xs',
      buttonSize: 'sm' as const
    },
    md: {
      container: 'p-4', // Extra padding beyond card default
      iconSize: 32,
      title: 'text-base font-medium',
      description: 'text-sm',
      buttonSize: 'default' as const
    },
    lg: {
      container: 'p-8', // Extra padding beyond card default
      iconSize: 48,
      title: 'text-lg font-medium',
      description: 'text-base',
      buttonSize: 'default' as const
    }
  };

  const classes = sizeClasses[size];

  const variantClasses = {
    default: wewriteCard('default'),
    dotted: 'bg-transparent border-2 border-dashed border-border rounded-xl p-4'
  };

  return (
    <div className={cn(
      variantClasses[variant],
      "text-center text-muted-foreground",
      classes.container,
      className
    )}>
      <Icon name={iconName} size={classes.iconSize} className={cn("mx-auto opacity-50 mb-3")} />
      <h3 className={cn("mb-1", classes.title)}>
        {title}
      </h3>
      <p className={classes.description}>
        {description}
      </p>
      {action && (
        <Button
          variant={action.variant || 'default'}
          size={classes.buttonSize}
          onClick={action.onClick}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
