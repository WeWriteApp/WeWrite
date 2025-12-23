"use client";

import React from 'react';
import { InlineError } from '../../../components/ui/InlineError';
import { ComponentShowcase, StateDemo } from './shared';

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

      <StateDemo label="Usage Examples">
        <div className="wewrite-card p-4 max-w-2xl">
          <h4 className="font-medium mb-2">When to Use Each Variant</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong className="text-orange-600 dark:text-orange-400">error</strong>: Form validation errors, API failures, auth errors</li>
            <li>• <strong className="text-amber-600 dark:text-amber-400">warning</strong>: Session timeouts, deprecation notices, incomplete actions</li>
            <li>• <strong className="text-primary">info</strong>: Helpful tips, auto-save confirmations, feature announcements</li>
          </ul>
          <h4 className="font-medium mt-4 mb-2">Size Guidelines</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <code className="bg-muted px-1 rounded">sm</code>: Inline form field errors, compact notices</li>
            <li>• <code className="bg-muted px-1 rounded">md</code>: Standard error cards, form-level errors</li>
            <li>• <code className="bg-muted px-1 rounded">lg</code>: Full page errors, error boundaries, critical alerts</li>
          </ul>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
