"use client";

import React from 'react';
import { Button } from '../../../components/ui/button';
import { Icon } from '../../../components/ui/Icon';
import { LoadingState, LoadingSpinner, SkeletonLine, SkeletonCard } from '../../../components/ui/LoadingState';
import { ComponentShowcase, StateDemo } from './shared';

export function LoadingStatesSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Loading States"
      path="app/components/ui/LoadingState.tsx"
      description="Standardized loading states with multiple visual variants. Use for consistent loading experiences across the app."
    >
      <StateDemo label="Loader (PulseLoader) - Size Variants">
        <div className="flex flex-wrap gap-8 items-end">
          <div className="flex flex-col items-center gap-2">
            <Icon name="Loader" size={12} />
            <span className="text-xs text-muted-foreground">12px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon name="Loader" size={16} />
            <span className="text-xs text-muted-foreground">16px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon name="Loader" size={20} />
            <span className="text-xs text-muted-foreground">20px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon name="Loader" size={24} />
            <span className="text-xs text-muted-foreground">24px (default)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon name="Loader" size={32} />
            <span className="text-xs text-muted-foreground">32px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon name="Loader" size={48} />
            <span className="text-xs text-muted-foreground">48px</span>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="LoaderGrid (GridLoader) - Alternative">
        <div className="flex flex-wrap gap-8 items-end">
          <div className="flex flex-col items-center gap-2">
            <Icon name="LoaderGrid" size={12} />
            <span className="text-xs text-muted-foreground">12px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon name="LoaderGrid" size={16} />
            <span className="text-xs text-muted-foreground">16px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon name="LoaderGrid" size={24} />
            <span className="text-xs text-muted-foreground">24px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon name="LoaderGrid" size={32} />
            <span className="text-xs text-muted-foreground">32px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon name="LoaderGrid" size={48} />
            <span className="text-xs text-muted-foreground">48px</span>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Loader - Color Variants">
        <div className="flex flex-wrap gap-8 items-center">
          <div className="flex flex-col items-center gap-2">
            <Icon name="Loader" size={24} />
            <span className="text-xs text-muted-foreground">Default (subtle)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon name="Loader" size={24} className="text-primary" />
            <span className="text-xs text-muted-foreground">text-primary</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon name="Loader" size={24} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">text-muted-foreground</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon name="Loader" size={24} className="text-foreground" />
            <span className="text-xs text-muted-foreground">text-foreground</span>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Loader - In Context">
        <div className="flex flex-wrap gap-6 items-center">
          <Button disabled>
            <Icon name="Loader" size={16} className="mr-2" />
            Saving...
          </Button>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-medium flex items-center gap-1">
            <Icon name="Loader" size={12} />
            Loading...
          </span>
          <div className="wewrite-card p-4 flex items-center justify-center w-32 h-32">
            <Icon name="Loader" size={32} />
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Pulse Variant">
        <div className="flex flex-wrap gap-8 items-end">
          <div className="flex flex-col items-center gap-2">
            <LoadingState variant="pulse" size="sm" minHeight="h-16" />
            <span className="text-xs text-muted-foreground">Small</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <LoadingState variant="pulse" size="md" minHeight="h-16" />
            <span className="text-xs text-muted-foreground">Medium</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <LoadingState variant="pulse" size="lg" minHeight="h-16" />
            <span className="text-xs text-muted-foreground">Large</span>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Skeleton Variant">
        <div className="wewrite-card p-4 max-w-sm">
          <LoadingState variant="skeleton" minHeight="h-auto" />
        </div>
      </StateDemo>

      <StateDemo label="Inline Components">
        <div className="flex flex-wrap gap-6 items-center">
          <div className="flex items-center gap-2">
            <LoadingSpinner size="sm" />
            <span className="text-sm">LoadingSpinner</span>
          </div>
          <Button disabled>
            <LoadingSpinner size="sm" className="mr-2" />
            Saving...
          </Button>
        </div>
      </StateDemo>

      <StateDemo label="Skeleton Components">
        <div className="space-y-4 max-w-md">
          <div className="space-y-2">
            <SkeletonLine width="w-3/4" />
            <SkeletonLine width="w-full" />
            <SkeletonLine width="w-1/2" />
          </div>
          <SkeletonCard />
        </div>
      </StateDemo>

      <StateDemo label="Real-World Example">
        <div className="wewrite-card p-6 w-full max-w-md">
          <h3 className="text-sm font-medium mb-4">Page Connections</h3>
          <LoadingState
            variant="spinner"
            message="Loading page connections..."
            minHeight="h-32"
          />
        </div>
      </StateDemo>

      <StateDemo label="Code Usage">
        <div className="wewrite-card p-4 bg-muted/30 max-w-2xl">
          <pre className="text-xs overflow-x-auto">
{`// Default loader (PulseLoader)
<Icon name="Loader" size={24} />

// Alternative grid loader
<Icon name="LoaderGrid" size={24} />

// With color
<Icon name="Loader" size={24} className="text-primary" />

// Inline in button
<Button disabled>
  <Icon name="Loader" size={16} className="mr-2" />
  Saving...
</Button>

// Skeleton placeholders
<SkeletonLine width="w-3/4" />
<SkeletonCard />`}
          </pre>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
