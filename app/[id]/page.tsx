"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getPageById } from "../firebase/database/pages";
import { getDatabase, ref, get } from "firebase/database";
import { rtdb } from "../firebase/config";
// Import the client-only wrapper
import ClientOnlyPageWrapper from '../components/pages/ClientOnlyPageWrapper';

// Optimized PageView with preloading and progressive loading
const PageView = dynamic(() => import('../components/pages/PageView'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-background">
      {/* Show page structure skeleton immediately */}
      <div className="p-5 md:p-4">
        {/* Header skeleton */}
        <div className="flex items-center mb-6">
          <div className="flex-1">
            <div className="h-9 w-20 bg-muted rounded-md animate-pulse" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="h-8 w-32 bg-muted rounded-md animate-pulse" />
          </div>
          <div className="flex-1 flex justify-end">
            <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
          </div>
        </div>

        {/* Page content skeleton */}
        <div className="space-y-6">
          <div className="h-10 w-3/4 bg-muted rounded-md animate-pulse" />
          <div className="space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded-md w-full animate-pulse" />
                <div className="h-4 bg-muted rounded-md w-5/6 animate-pulse" />
                <div className="h-4 bg-muted rounded-md w-4/6 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
});

// Preload PageView component to reduce loading time
if (typeof window !== 'undefined') {
  import('../components/pages/PageView');
}

// Error boundary component for PageView - simplified error handling
class PageViewErrorBoundary extends React.Component<
  { children: React.ReactNode; pageId: string },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; pageId: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PageView Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold mb-4">Page Loading Error</h2>
            <p className="text-muted-foreground mb-4">
              There was an error loading this page. This might be due to a temporary issue.
            </p>
            <div className="space-y-2">
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Refresh Page
              </Button>
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="w-full"
              >
                Go Back
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
import UnifiedLoader from '../components/ui/unified-loader';
import { ErrorDisplay } from '../components/ui/error-display';
import { Button } from '../components/ui/button';
import { useAuth } from '../providers/AuthProvider';
import { startPageLoadTracking, recordPageError, finishPageLoadTracking } from '../utils/pageLoadPerformance';

export default function ContentPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const currentAccountUid = user?.uid;
  const [contentType, setContentType] = useState<'page' | 'not-found' | 'error' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [id, setId] = useState('');

  useEffect(() => {
    async function processParams() {
      let extractedId = '';
      try {
        // Simplified params processing
        const unwrappedParams = await Promise.resolve(params);
        extractedId = unwrappedParams?.id || '';

        // Clean up the ID
        if (extractedId.includes('%2F')) {
          extractedId = decodeURIComponent(extractedId);
        }
        if (extractedId.includes('/')) {
          extractedId = extractedId.split('/')[0];
        }

        console.log('🔍 ContentPage: Extracted ID:', extractedId);
        setId(extractedId);

        // OPTIMIZATION: Start performance tracking
        if (extractedId) {
          startPageLoadTracking(extractedId);
        }
      } catch (error) {
        console.error('Error processing params:', error);
        setContentType('error');
        setIsLoading(false);

        // Record error in performance tracking
        if (extractedId) {
          recordPageError(extractedId);
        }
      }
    }

    processParams();
  }, [params]);

  useEffect(() => {
    if (!id) return;

    async function determineContentType() {
      try {
        console.log('🔍 ContentPage: Determining content type for ID:', id);

        // Basic ID validation
        const cleanId = id.trim();
        if (!cleanId || cleanId.includes('/') || cleanId.includes('\\')) {
          setContentType('not-found');
          setIsLoading(false);
          return;
        }

        // Check if this is a deleted page preview
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('preview') === 'deleted') {
          setContentType('page');
          setIsLoading(false);
          return;
        }

        // OPTIMIZATION: Use faster API route instead of direct Firebase calls
        try {
          const response = await fetch(`/api/pages/${cleanId}${currentAccountUid ? `?userId=${currentAccountUid}` : ''}`, {
            method: 'GET',
            headers: {
              'Cache-Control': 'max-age=30', // Cache for 30 seconds
            }
          });

          if (response.ok) {
            setContentType('page');
            setIsLoading(false);
            return;
          } else if (response.status === 404) {
            // Check if it's a user ID and redirect
            try {
              const userCheckResponse = await fetch(`/api/users/${cleanId}/check`, {
                method: 'HEAD', // Use HEAD for faster response
              });
              if (userCheckResponse.ok) {
                router.replace(`/user/${cleanId}`);
                return;
              }
            } catch (userError) {
              console.error("Error checking user ID:", userError);
            }

            setContentType('not-found');
            setIsLoading(false);
            return;
          } else {
            throw new Error(`API returned ${response.status}`);
          }
        } catch (apiError) {
          console.warn("Fast API check failed, falling back to Firebase:", apiError);

          // Fallback to original logic
          const pageResult = await getPageById(cleanId, currentAccountUid);
          if (pageResult.pageData || (pageResult.error && pageResult.error !== "Page not found")) {
            setContentType('page');
            setIsLoading(false);
            return;
          }

          // Check if it's a user ID and redirect
          try {
            const userRef = ref(rtdb, `users/${cleanId}`);
            const userSnapshot = await get(userRef);
            if (userSnapshot.exists()) {
              router.replace(`/user/${cleanId}`);
              return;
            }
          } catch (error) {
            console.error("Error checking user ID:", error);
          }

          setContentType('not-found');
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error determining content type:", error);
        setContentType('error');
        setIsLoading(false);
      }
    }

    determineContentType();
  }, [id, router, currentAccountUid]);

  console.log('🔍 ContentPage: Render state check', {
    isLoading,
    contentType,
    id,
    authLoading,
    currentAccountUid
  });

  if (isLoading) {
    console.log('🔍 ContentPage: Showing progressive loading skeleton because isLoading is true');
    return (
      <div className="min-h-screen bg-background">
        {/* Show page structure skeleton immediately */}
        <div className="p-5 md:p-4">
          {/* Header skeleton */}
          <div className="flex items-center mb-6">
            <div className="flex-1">
              <div className="h-9 w-20 bg-muted rounded-md animate-pulse" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="h-8 w-32 bg-muted rounded-md animate-pulse" />
            </div>
            <div className="flex-1 flex justify-end">
              <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
            </div>
          </div>

          {/* Content skeleton */}
          <div className="space-y-6">
            <div className="h-10 w-3/4 bg-muted rounded-md animate-pulse" />
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-muted rounded-md w-full animate-pulse" />
                  <div className="h-4 bg-muted rounded-md w-5/6 animate-pulse" />
                  <div className="h-4 bg-muted rounded-md w-4/6 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (contentType === 'page') {
    console.log('🔍 ContentPage: Rendering PageView for ID:', id);
    return (
      <ClientOnlyPageWrapper>
        <PageViewErrorBoundary pageId={id}>
          <PageView params={{ id }} />
        </PageViewErrorBoundary>
      </ClientOnlyPageWrapper>
    );
  }

  if (contentType === 'not-found') {
    // Log the not-found case for debugging
    console.log('🔍 ContentPage: Rendering not-found for ID:', id);

    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
          <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
          <Button onClick={() => router.push('/')} className="mt-4">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (contentType === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <div className="max-w-md w-full">
          <ErrorDisplay
            message="There was an error loading this content."
            severity="error"
            title="Content Error"
            showDetails={false}
            showRetry={true}
            onRetry={() => window.location.reload()}
            className="mb-6"
          />
          <div className="flex justify-center">
            <Button onClick={() => window.history.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <UnifiedLoader
      isLoading={true}
      message="Loading content..."
      onRetry={() => window.location.reload()}
    />
  );
}