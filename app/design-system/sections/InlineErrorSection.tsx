"use client";

import React from 'react';
import { InlineError } from '../../components/ui/InlineError';
import { ComponentShowcase, StateDemo, CollapsibleDocs, DocsCodeBlock } from './shared';

export function InlineErrorSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Inline Error Cards"
      path="app/components/ui/InlineError.tsx"
      description="Unified error, warning, and info display component with multiple variants and sizes"
    >
      <StateDemo label="Variants">
        <div className="w-full space-y-3">
          <InlineError
            message="Something went wrong. Please try again."
            variant="error"
            size="md"
          />
          <InlineError
            message="Your session will expire in 5 minutes."
            variant="warning"
            size="md"
          />
          <InlineError
            message="Your changes have been saved automatically."
            variant="info"
            size="md"
          />
        </div>
      </StateDemo>

      <StateDemo label="Sizes">
        <div className="w-full space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Small (sm)</p>
            <InlineError
              message="Invalid email format"
              variant="error"
              size="sm"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Medium (md) - Default</p>
            <InlineError
              message="Failed to save changes. Please check your connection."
              variant="error"
              size="md"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Large (lg)</p>
            <InlineError
              message="We couldn't load your data. This might be a temporary issue."
              title="Connection Error"
              variant="error"
              size="lg"
            />
          </div>
        </div>
      </StateDemo>

      <StateDemo label="With Actions">
        <div className="w-full space-y-3">
          <InlineError
            message="Failed to load page content."
            variant="error"
            size="md"
            onRetry={() => alert('Retry clicked!')}
            retryLabel="Retry"
          />
          <InlineError
            message="An unexpected error occurred."
            variant="error"
            size="md"
            errorDetails="Error: NETWORK_ERROR\nTimestamp: 2024-01-15T10:30:00Z\nStack: at fetchData (app.js:42)"
            showCopy={true}
          />
          <InlineError
            message="Unable to process your request."
            title="Request Failed"
            variant="error"
            size="lg"
            errorDetails="Error: 500 Internal Server Error\nRequest ID: abc-123-def"
            showCopy={true}
            showCollapsible={true}
            onRetry={() => alert('Retry clicked!')}
          />
        </div>
      </StateDemo>

      <CollapsibleDocs type="usage" title="Usage Guidelines">
        <h4 className="font-medium mb-2">When to Use Each Variant</h4>
        <ul className="text-sm text-muted-foreground space-y-1 mb-4">
          <li>• <strong className="text-orange-600 dark:text-orange-400">error</strong>: Form validation errors, API failures, auth errors</li>
          <li>• <strong className="text-amber-600 dark:text-amber-400">warning</strong>: Session timeouts, deprecation notices, incomplete actions</li>
          <li>• <strong className="text-primary">info</strong>: Helpful tips, auto-save confirmations, feature announcements</li>
        </ul>

        <h4 className="font-medium mb-2">Size Guidelines</h4>
        <ul className="text-sm text-muted-foreground space-y-1 mb-4">
          <li>• <code className="bg-muted px-1 rounded">sm</code>: Inline form field errors, compact notices</li>
          <li>• <code className="bg-muted px-1 rounded">md</code>: Standard error cards, form-level errors</li>
          <li>• <code className="bg-muted px-1 rounded">lg</code>: Full page errors, error boundaries, critical alerts</li>
        </ul>

        <DocsCodeBlock label="Import">
{`import { InlineError } from '@/components/ui/InlineError';`}
        </DocsCodeBlock>

        <DocsCodeBlock label="Basic Usage">
{`<InlineError
  message="Something went wrong. Please try again."
  variant="error"
  size="md"
/>`}
        </DocsCodeBlock>

        <DocsCodeBlock label="With Retry Action">
{`<InlineError
  message="Failed to load page content."
  variant="error"
  size="md"
  onRetry={() => refetch()}
  retryLabel="Retry"
/>`}
        </DocsCodeBlock>

        <DocsCodeBlock label="With Error Details">
{`<InlineError
  message="An unexpected error occurred."
  variant="error"
  size="lg"
  title="Request Failed"
  errorDetails="Error: 500 Internal Server Error\\nRequest ID: abc-123-def"
  showCopy={true}
  showCollapsible={true}
  onRetry={() => retry()}
/>`}
        </DocsCodeBlock>
      </CollapsibleDocs>

      <CollapsibleDocs type="props">
        <div className="space-y-2 text-sm w-full">
          <div className="flex gap-2 items-start">
            <code className="px-2 py-1 bg-muted rounded text-xs whitespace-nowrap">message: string</code>
            <span className="text-muted-foreground">- Required. The main error/warning/info message</span>
          </div>
          <div className="flex gap-2 items-start">
            <code className="px-2 py-1 bg-muted rounded text-xs whitespace-nowrap">variant?: 'error' | 'warning' | 'info'</code>
            <span className="text-muted-foreground">- Optional. Style variant (default: 'error')</span>
          </div>
          <div className="flex gap-2 items-start">
            <code className="px-2 py-1 bg-muted rounded text-xs whitespace-nowrap">size?: 'sm' | 'md' | 'lg'</code>
            <span className="text-muted-foreground">- Optional. Size variant (default: 'md')</span>
          </div>
          <div className="flex gap-2 items-start">
            <code className="px-2 py-1 bg-muted rounded text-xs whitespace-nowrap">title?: string</code>
            <span className="text-muted-foreground">- Optional. Title text for large sizes</span>
          </div>
          <div className="flex gap-2 items-start">
            <code className="px-2 py-1 bg-muted rounded text-xs whitespace-nowrap">onRetry?: () =&gt; void</code>
            <span className="text-muted-foreground">- Optional. Callback for retry button</span>
          </div>
          <div className="flex gap-2 items-start">
            <code className="px-2 py-1 bg-muted rounded text-xs whitespace-nowrap">retryLabel?: string</code>
            <span className="text-muted-foreground">- Optional. Custom retry button label</span>
          </div>
          <div className="flex gap-2 items-start">
            <code className="px-2 py-1 bg-muted rounded text-xs whitespace-nowrap">errorDetails?: string</code>
            <span className="text-muted-foreground">- Optional. Technical error details</span>
          </div>
          <div className="flex gap-2 items-start">
            <code className="px-2 py-1 bg-muted rounded text-xs whitespace-nowrap">showCopy?: boolean</code>
            <span className="text-muted-foreground">- Optional. Show copy button for error details</span>
          </div>
          <div className="flex gap-2 items-start">
            <code className="px-2 py-1 bg-muted rounded text-xs whitespace-nowrap">showCollapsible?: boolean</code>
            <span className="text-muted-foreground">- Optional. Make error details collapsible</span>
          </div>
          <div className="flex gap-2 items-start">
            <code className="px-2 py-1 bg-muted rounded text-xs whitespace-nowrap">className?: string</code>
            <span className="text-muted-foreground">- Optional. Additional CSS classes</span>
          </div>
        </div>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
