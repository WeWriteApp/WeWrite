"use client";

import React from 'react';
import { Icon, IconName } from '@/components/ui/Icon';
import { cn, wewriteCard } from '../../lib/utils';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
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
  size = 'md'
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: '',
      iconSize: 24,
      title: 'text-sm font-medium',
      description: 'text-xs'
    },
    md: {
      container: 'p-4', // Extra padding beyond card default
      iconSize: 32,
      title: 'text-base font-medium',
      description: 'text-sm'
    },
    lg: {
      container: 'p-8', // Extra padding beyond card default
      iconSize: 48,
      title: 'text-lg font-medium',
      description: 'text-base'
    }
  };

  const classes = sizeClasses[size];

  return (
    <div className={cn(
      wewriteCard('default'),
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
    </div>
  );
}
