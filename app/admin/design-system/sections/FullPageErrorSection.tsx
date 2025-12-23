"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../../components/ui/button';
import FullPageError from '../../../components/ui/FullPageError';
import { ComponentShowcase, StateDemo } from './shared';

export function FullPageErrorSection({ id }: { id: string }) {
  const [showFullPageError, setShowFullPageError] = useState(false);

  return (
    <ComponentShowcase
      id={id}
      title="Full Page Error"
      path="app/components/ui/FullPageError.tsx"
      description="Full-screen error page shown when critical errors occur. Includes action buttons, collapsible error details, and copy-to-clipboard functionality."
    >
      <StateDemo label="Preview">
        <Button onClick={() => setShowFullPageError(true)}>
          Show Full Page Error
        </Button>
      </StateDemo>

      <StateDemo label="Inline Preview (Scaled)">
        <div className="w-full border rounded-lg overflow-hidden bg-background">
          <div className="transform scale-75 origin-top" style={{ height: '400px' }}>
            <div className="min-h-full flex flex-col items-center justify-center p-4 bg-background">
              <div className="max-w-md w-full wewrite-card p-8 rounded-lg shadow-lg text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
                    <Icon name="AlertCircle" size={32} className="text-amber-600 dark:text-amber-400" />
                  </div>
                </div>

                <h1 className="text-4xl font-bold mb-4">Something went wrong</h1>
                <p className="text-lg text-muted-foreground mb-8">We&apos;re sorry, but there was an error loading this page.</p>

                <div className="flex flex-col gap-4 mb-6">
                  <Button size="lg" className="gap-2 w-full">
                    <Icon name="RefreshCw" size={20} />
                    Try again
                  </Button>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button size="lg" className="gap-2 w-full sm:w-1/2">
                      <Icon name="Home" size={20} />
                      Back to Home
                    </Button>

                    <Button variant="secondary" size="lg" className="gap-2 w-full sm:w-1/2">
                      <Icon name="ArrowLeft" size={20} />
                      Go Back
                    </Button>
                  </div>
                </div>

                <Button variant="secondary" className="w-full flex items-center justify-between p-4">
                  <span>Error Details</span>
                  <Icon name="ChevronDown" size={16} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Props">
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
      </StateDemo>

      <StateDemo label="Code Usage">
        <div className="wewrite-card p-4 bg-muted/30 max-w-2xl">
          <pre className="text-xs overflow-x-auto">
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
          </pre>
        </div>
      </StateDemo>

      {/* Full Page Error Modal */}
      {showFullPageError && (
        <div className="fixed inset-0 z-50">
          <div className="absolute top-4 right-4 z-50">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowFullPageError(false)}
              className="shadow-lg"
            >
              <Icon name="X" size={16} className="mr-2" />
              Close Demo
            </Button>
          </div>
          <FullPageError
            error={new Error("This is a demo error message for testing purposes. The component displays error details, provides action buttons, and allows copying error info to clipboard.")}
            title="Something went wrong"
            message="We're sorry, but there was an error loading this page."
            onRetry={() => setShowFullPageError(false)}
          />
        </div>
      )}
    </ComponentShowcase>
  );
}
