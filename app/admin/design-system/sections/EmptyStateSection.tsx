"use client";

import React from 'react';
import EmptyState from '../../../components/ui/EmptyState';
import { ComponentShowcase, StateDemo } from './shared';

export function EmptyStateSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Empty State"
      path="app/components/ui/EmptyState.tsx"
      description="Standardized empty state component for consistent messaging when content is unavailable"
    >
      <StateDemo label="Size Variants">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Small (sm)</p>
            <EmptyState
              icon="Tags"
              title="No alternative titles"
              description="Add alternative titles to help people find this page."
              size="sm"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Medium (md) - Default</p>
            <EmptyState
              icon="Inbox"
              title="No messages"
              description="When you receive messages, they'll appear here."
              size="md"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Large (lg)</p>
            <EmptyState
              icon="Folder"
              title="No pages yet"
              description="Create your first page to get started with WeWrite."
              size="lg"
            />
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Common Use Cases">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          <EmptyState
            icon="FileText"
            title="No recent activity"
            description="Your recent edits and activity will show up here."
            size="sm"
          />
          <EmptyState
            icon="Users"
            title="No followers yet"
            description="When people follow you, they'll appear in this list."
            size="sm"
          />
        </div>
      </StateDemo>

      <StateDemo label="Props">
        <div className="space-y-2 text-sm w-full">
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">icon: LucideIcon</code>
            <span className="text-muted-foreground">- Required. Icon component from lucide-react</span>
          </div>
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">title: string</code>
            <span className="text-muted-foreground">- Required. Main heading text</span>
          </div>
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">description: string</code>
            <span className="text-muted-foreground">- Required. Supporting description text</span>
          </div>
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">size?: 'sm' | 'md' | 'lg'</code>
            <span className="text-muted-foreground">- Optional. Controls padding and text size (default: 'md')</span>
          </div>
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">className?: string</code>
            <span className="text-muted-foreground">- Optional. Additional CSS classes</span>
          </div>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
