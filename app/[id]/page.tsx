"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
// Import the client-only wrapper
import ClientOnlyPageWrapper from '../components/pages/ClientOnlyPageWrapper';

// Force this page to be fully client-side rendered
export const dynamicParams = true;

// Dynamically import Firebase modules to avoid server-side issues
const getFirebaseModules = async () => {
  const [{ getPageById }, { getDatabase, ref, get }, { rtdb }] = await Promise.all([
    import("../firebase/database/pages"),
    import("firebase/database"),
    import("../firebase/config")
  ]);
  return { getPageById, getDatabase, ref, get, rtdb };
};

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
        <FullPageError
          error={this.state.error}
          title="Page Loading Error"
          message="There was an error loading this page. This might be due to a temporary issue."
          onRetry={() => window.location.reload()}
          showGoHome={true}
          showGoBack={true}
          showTryAgain={true}
        />
      );
    }

    return this.props.children;
  }
}
import UnifiedLoader from '../components/ui/unified-loader';
import { ErrorDisplay } from '../components/ui/error-display';
import { Button } from '../components/ui/button';
import FullPageError from '../components/ui/FullPageError';
import PageDeletedView from '../components/pages/PageDeletedView';
import { useAuth } from '../providers/AuthProvider';
import { startPageLoadTracking, recordPageError, finishPageLoadTracking } from '../utils/pageLoadPerformance';

export default function ContentPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const currentAccountUid = user?.uid;
  const [contentType, setContentType] = useState<'page' | 'not-found' | 'deleted' | 'error' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [id, setId] = useState('');
  const [pageTitle, setPageTitle] = useState<string>('');

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

        // Handle new page creation from inline links (new:title format)
        if (cleanId.startsWith('new:')) {
          const title = cleanId.substring(4); // Remove 'new:' prefix
          if (title) {
            // Redirect to /new with the title parameter
            router.replace(`/new?title=${encodeURIComponent(title)}`);
            return;
          } else {
            // If no title provided, just redirect to /new
            router.replace('/new');
            return;
          }
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
            const pageData = await response.json();
            // Check if the page is deleted (now included in main API response)
            if (pageData?.deleted === true) {
              setPageTitle(pageData.title || 'Untitled');
              setContentType('deleted');
              setIsLoading(false);
              return;
            }
            setContentType('page');
            setIsLoading(false);
            return;
          } else if (response.status === 404) {
            // Could be deleted page or truly not found - check response body
            try {
              const errorData = await response.json();
              if (errorData?.pageData?.deleted === true) {
                setPageTitle(errorData.pageData.title || 'Untitled');
                setContentType('deleted');
                setIsLoading(false);
                return;
              }
            } catch (parseError) {
              console.log("Could not parse 404 response body");
            }

            // Page truly not found (not just deleted)
            console.log("Page not found via API");

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

          try {
            // Dynamically import Firebase modules
            const { getPageById, ref, get, rtdb } = await getFirebaseModules();

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
          } catch (firebaseError) {
            console.error("Error loading Firebase modules:", firebaseError);
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

  if (contentType === 'deleted') {
    console.log('🔍 ContentPage: Rendering deleted page view for ID:', id);
    return (
      <PageDeletedView
        pageTitle={pageTitle}
        pageId={id}
      />
    );
  }

  if (contentType === 'not-found') {
    // Log the not-found case for debugging
    console.log('🔍 ContentPage: Rendering not-found for ID:', id);

    return (
      <FullPageError
        title="Page Not Found"
        message="The page you're looking for doesn't exist."
        showGoBack={true}
        showGoHome={true}
        showTryAgain={false}
      />
    );
  }

  if (contentType === 'error') {
    return (
      <FullPageError
        title="Content Error"
        message="There was an error loading this content."
        showGoBack={true}
        showGoHome={true}
        showTryAgain={true}
        onRetry={() => window.location.reload()}
      />
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