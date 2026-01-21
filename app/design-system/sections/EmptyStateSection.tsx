"use client";

import React from 'react';
import EmptyState from '../../components/ui/EmptyState';
import { ComponentShowcase, StateDemo, CollapsibleDocs, DocsCodeBlock } from './shared';

export function EmptyStateSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Empty State"
      path="app/components/ui/EmptyState.tsx"
      description="Standardized empty state component for consistent messaging when content is unavailable. All empty states use a unified dotted border style."
    >
      <StateDemo label="Default Style">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Basic empty state</p>
            <EmptyState
              icon="Inbox"
              title="No messages"
              description="When you receive messages, they'll appear here."
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">With different icon</p>
            <EmptyState
              icon="Plus"
              title="No items yet"
              description="Add your first item to get started."
            />
          </div>
        </div>
      </StateDemo>

      <StateDemo label="With Action Button">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Default button</p>
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
            <p className="text-xs text-muted-foreground mb-2">Outline button variant</p>
            <EmptyState
              icon="Upload"
              title="No uploads"
              description="Drag and drop files here or click to upload."
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

      <StateDemo label="Large Size with Action">
        <div className="max-w-md mx-auto">
          <EmptyState
            icon="FolderPlus"
            title="Create your first project"
            description="Projects help you organize your pages and collaborate with others."
            size="lg"
            action={{
              label: "New Project",
              onClick: () => alert('New project!')
            }}
          />
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

      <StateDemo label="CSS Class: empty-state-border">
        <div className="space-y-4 w-full">
          <p className="text-sm text-muted-foreground">
            All empty states use the <code className="bg-muted px-1 rounded">empty-state-border</code> CSS class
            for consistent dashed borders. This class can also be used on custom components:
          </p>
          <div className="empty-state-border rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground">Custom element with empty-state-border class</p>
          </div>
        </div>
      </StateDemo>

      <CollapsibleDocs type="usage">
        <DocsCodeBlock label="Import">
{`import EmptyState from '@/components/ui/EmptyState';`}
        </DocsCodeBlock>

        <DocsCodeBlock label="Basic Usage">
{`<EmptyState
  icon="Inbox"
  title="No messages"
  description="When you receive messages, they'll appear here."
/>`}
        </DocsCodeBlock>

        <DocsCodeBlock label="With Action Button">
{`<EmptyState
  icon="FileText"
  title="No pages yet"
  description="Create your first page to get started."
  action={{
    label: "Create Page",
    onClick: () => handleCreate(),
    variant: 'outline' // optional
  }}
/>`}
        </DocsCodeBlock>

        <DocsCodeBlock label="Size Variants">
{`// Small - for compact spaces
<EmptyState size="sm" icon="Tags" title="No tags" description="..." />

// Medium (default) - standard usage
<EmptyState size="md" icon="Inbox" title="No messages" description="..." />

// Large - for primary empty states
<EmptyState size="lg" icon="Folder" title="No projects" description="..." />`}
        </DocsCodeBlock>
      </CollapsibleDocs>

      <CollapsibleDocs type="props">
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
            <code className="px-2 py-1 bg-muted rounded text-xs">action?: {'{label, onClick, variant?}'}</code>
            <span className="text-muted-foreground">- Optional. Action button configuration</span>
          </div>
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">className?: string</code>
            <span className="text-muted-foreground">- Optional. Additional CSS classes</span>
          </div>
        </div>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
