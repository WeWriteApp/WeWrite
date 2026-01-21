"use client";

import React from 'react';
import { Button } from '../../components/ui/button';
import FullPageError from '../../components/ui/FullPageError';
import { ComponentShowcase, StateDemo, CollapsibleDocs, DocsCodeBlock } from './shared';
import Link from 'next/link';

export function FullPageErrorSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Full Page Error"
      path="app/components/ui/FullPageError.tsx"
      description="Full-screen error page shown when critical errors occur. Includes action buttons, collapsible error details, and copy-to-clipboard functionality."
    >
      <StateDemo label="Preview">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Click below to see the full page error component in action. The demo opens in a separate page to show the full-screen experience.
          </p>
          <Link href="/design-system/full-page-error-demo">
            <Button>
              View Full Page Error Demo
            </Button>
          </Link>
        </div>
      </StateDemo>

      <CollapsibleDocs type="props">
        <div className="wewrite-card p-4 bg-muted/30 max-w-2xl space-y-2">
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li><code className="bg-muted px-1 rounded">error</code> - Error object with message, stack, and optional digest</li>
            <li><code className="bg-muted px-1 rounded">reset</code> - Function to reset the error boundary</li>
            <li><code className="bg-muted px-1 rounded">title</code> - Custom title (default: &quot;Something went wrong&quot;)</li>
            <li><code className="bg-muted px-1 rounded">message</code> - Custom message</li>
            <li><code className="bg-muted px-1 rounded">showGoBack</code> - Show &quot;Go Back&quot; button (default: true)</li>
            <li><code className="bg-muted px-1 rounded">showGoHome</code> - Show &quot;Back to Home&quot; button (default: true)</li>
            <li><code className="bg-muted px-1 rounded">showTryAgain</code> - Show &quot;Try Again&quot; button (default: true)</li>
            <li><code className="bg-muted px-1 rounded">onRetry</code> - Custom retry function</li>
          </ul>
        </div>
      </CollapsibleDocs>

      <CollapsibleDocs type="usage">
        <DocsCodeBlock label="Error boundary usage">
{`// In error.tsx or error boundary
import FullPageError from '@/components/ui/FullPageError';

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <FullPageError
      error={error}
      reset={reset}
      title="Page Error"
      message="This page encountered an unexpected error."
      showGoBack={true}
      showGoHome={true}
      showTryAgain={true}
    />
  );
}`}
        </DocsCodeBlock>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
