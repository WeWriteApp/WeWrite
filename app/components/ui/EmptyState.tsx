"use client";

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn, wewriteCard } from '../../lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
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
  icon: Icon,
  title,
  description,
  className,
  size = 'md'
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: '',
      icon: 'h-6 w-6 mb-2',
      title: 'text-sm font-medium',
      description: 'text-xs'
    },
    md: {
      container: 'p-4', // Extra padding beyond card default
      icon: 'h-8 w-8 mb-3',
      title: 'text-base font-medium',
      description: 'text-sm'
    },
    lg: {
      container: 'p-8', // Extra padding beyond card default
      icon: 'h-12 w-12 mb-4',
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
      <Icon className={cn("mx-auto opacity-50", classes.icon)} />
      <h3 className={cn("mb-1", classes.title)}>
        {title}
      </h3>
      <p className={classes.description}>
        {description}
      </p>
    </div>
  );
}
