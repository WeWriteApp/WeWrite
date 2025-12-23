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
      <StateDemo label="Variant Styles">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Default (card background)</p>
            <EmptyState
              icon="Inbox"
              title="No messages"
              description="When you receive messages, they'll appear here."
              variant="default"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Dotted (transparent with dashed border)</p>
            <EmptyState
              icon="Plus"
              title="No items yet"
              description="Add your first item to get started."
              variant="dotted"
            />
          </div>
        </div>
      </StateDemo>

      <StateDemo label="With Action Button">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Default variant with action</p>
            <EmptyState
              icon="FileText"
              title="No pages yet"
              description="Create your first page to get started."
              action={{
                label: "Create Page",
                onClick: () => alert('Create page clicked!')
              }}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Dotted variant with action</p>
            <EmptyState
              icon="Upload"
              title="No uploads"
              description="Drag and drop files here or click to upload."
              variant="dotted"
              action={{
                label: "Upload Files",
                onClick: () => alert('Upload clicked!'),
                variant: 'outline'
              }}
            />
          </div>
        </div>
      </StateDemo>

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

      <StateDemo label="Dotted Variant Sizes">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Small dotted</p>
            <EmptyState
              icon="Image"
              title="No image"
              description="Add an image to enhance your content."
              size="sm"
              variant="dotted"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Medium dotted</p>
            <EmptyState
              icon="Link"
              title="No links"
              description="Add external links to reference sources."
              size="md"
              variant="dotted"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Large dotted with action</p>
            <EmptyState
              icon="FolderPlus"
              title="Create your first project"
              description="Projects help you organize your pages and collaborate with others."
              size="lg"
              variant="dotted"
              action={{
                label: "New Project",
                onClick: () => alert('New project!')
              }}
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
            <code className="px-2 py-1 bg-muted rounded text-xs">icon: IconName</code>
            <span className="text-muted-foreground">- Required. Icon name from the Icon component</span>
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
            <code className="px-2 py-1 bg-muted rounded text-xs">variant?: 'default' | 'dotted'</code>
            <span className="text-muted-foreground">- Optional. Visual style (default: 'default')</span>
          </div>
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">action?: {'{label, onClick, variant?}'}</code>
            <span className="text-muted-foreground">- Optional. Action button configuration</span>
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
