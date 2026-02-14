"use client";

import React from 'react';
import { Icon } from '../../components/ui/Icon';
import { LoadingState, SkeletonLine, SkeletonCard } from '../../components/ui/LoadingState';
import { ComponentShowcase, StateDemo, CollapsibleDocs, DocsCodeBlock } from './shared';

export function LoadingStatesSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Loading States"
      path="app/components/ui/LoadingState.tsx"
      description="Standardized loading states. Always use the default Loader style (no color classes) for consistency."
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

      <StateDemo label="Bordered Loading State (matches EmptyState)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Small</p>
            <LoadingState
              message="Loading..."
              showBorder
              size="sm"
              minHeight="h-24"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Medium (default)</p>
            <LoadingState
              message="Loading content..."
              showBorder
              size="md"
              minHeight="h-32"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Large</p>
            <LoadingState
              message="Loading page data..."
              showBorder
              size="lg"
              minHeight="h-40"
            />
          </div>
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

      <StateDemo label="Anti-Patterns">
        <div className="w-full space-y-4">
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <span className="text-xs font-bold text-red-500 uppercase">Wrong</span>
                <div className="animate-spin">
                  <Icon name="Loader" size={20} />
                </div>
              </div>
              <code className="text-xs text-muted-foreground">{'<Icon name="Loader" className="animate-spin" />'}</code>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <span className="text-xs font-bold text-green-500 uppercase">Right</span>
                <Icon name="Loader" size={20} />
              </div>
              <code className="text-xs text-muted-foreground">{'<Icon name="Loader" />'}</code>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The PulseLoader has built-in animation. Never wrap it in <code className="text-foreground">animate-spin</code> or any spinning container &mdash; animation is atomic (inside the loader), not molecular (applied by a parent).
          </p>
        </div>
      </StateDemo>

      <CollapsibleDocs type="usage">
        <DocsCodeBlock label="Loading state usage">
{`// Default loader (PulseLoader) - always use default style
<Icon name="Loader" size={24} />

// Size variants
<Icon name="Loader" size={16} />  // small
<Icon name="Loader" size={32} />  // large

// WRONG - never add animate-spin to Loader (it already animates)
// <Icon name="Loader" className="animate-spin" />

// WRONG - don't use Loader2, use Loader instead
// <Icon name="Loader2" className="animate-spin" />

// Bordered loading state (matches EmptyState style)
<LoadingState
  message="Loading content..."
  showBorder
  size="md"
  minHeight="h-32"
/>

// Skeleton placeholders
<SkeletonLine width="w-3/4" />
<SkeletonCard />`}
        </DocsCodeBlock>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
