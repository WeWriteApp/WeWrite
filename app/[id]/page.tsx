"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getPageById } from "../firebase/database/pages";
import { getDatabase, ref, get } from "firebase/database";
import { rtdb } from "../firebase/config";
// Import the client-only wrapper
import ClientOnlyPageWrapper from '../components/pages/ClientOnlyPageWrapper';

// Ultra-safe dynamic import to prevent all hydration issues
const SafePageView = dynamic(() => import('../components/pages/SafePageView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[50vh] p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Loading page...</p>
      </div>
    </div>
  )
});

// Error boundary component for PageView
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
import { SmartLoader } from '../components/ui/smart-loader';
import { ErrorDisplay } from '../components/ui/error-display';
import { Button } from '../components/ui/button';
import { useAuth } from '../providers/AuthProvider';

export default function ContentPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const currentAccountUid = user?.uid;
  const [contentType, setContentType] = useState<'page' | 'not-found' | 'error' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [id, setId] = useState('');

  useEffect(() => {
    async function processParams() {
      try {
        // Handle params Promise or direct object
        let unwrappedParams;
        if (params && typeof (params as any).then === 'function') {
          unwrappedParams = await (params as Promise<{ id: string }>);
        } else {
          unwrappedParams = (params as { id: string }) || {};
        }

        let extractedId = unwrappedParams.id || '';

        // If the ID contains encoded slashes, decode them
        if (extractedId && extractedId.includes('%2F')) {
          extractedId = decodeURIComponent(extractedId);
        }

        // If the ID contains slashes, extract the first part
        if (extractedId && extractedId.includes('/')) {
          extractedId = extractedId.split('/')[0];
        }

        console.log('🔍 ContentPage: Extracted ID:', extractedId);
        setId(extractedId);
      } catch (error) {
        console.error('Error processing params:', error);
        setId('');
      }
    }

    processParams();
  }, [params]);

  useEffect(() => {
    if (!id) return;

    // Don't wait for auth for public pages - they should be accessible regardless
    // if (authLoading) return;

    async function determineContentType() {
      try {
        console.log('🔍 ContentPage: Determining content type for ID:', id);
        console.log('🔍 ContentPage: Auth loading:', authLoading, 'Current account:', currentAccountUid);

        // Validate the ID before making Firestore calls
        if (!id || typeof id !== 'string' || id.trim() === '') {
          console.error('Invalid ID provided:', id);
          setContentType('not-found');
          setIsLoading(false);
          return;
        }

        // Clean the ID and validate it's a proper Firestore document ID
        const cleanId = id.trim();
        if (cleanId.includes('/') || cleanId.includes('\\') || cleanId === '.' || cleanId === '..') {
          console.error('Invalid document ID format:', cleanId);
          setContentType('not-found');
          setIsLoading(false);
          return;
        }

        // Check if this is a deleted page preview request
        const urlParams = new URLSearchParams(window.location.search);
        const isPreviewingDeleted = urlParams.get('preview') === 'deleted';

        if (isPreviewingDeleted) {
          console.log('Deleted page preview requested, allowing page component to handle access control');
          setContentType('page');
          setIsLoading(false);
          return;
        }

        // First, check if it's a page using proper access control
        console.log('🔍 ContentPage: Checking if ID is a page:', cleanId);
        const pageResult = await getPageById(cleanId, currentAccountUid);
        console.log('🔍 ContentPage: Page result:', {
          hasPageData: !!pageResult.pageData,
          error: pageResult.error,
          pageTitle: pageResult.pageData?.title,
          fullPageResult: pageResult
        });

        if (pageResult.pageData) {
          console.log('🔍 ContentPage: Found valid page, setting contentType to page');
          setContentType('page');
          setIsLoading(false);
          return;
        } else if (pageResult.error && pageResult.error !== "Page not found") {
          console.log('🔍 ContentPage: Page error but not "not found", treating as page');
          setContentType('page');
          setIsLoading(false);
          return;
        }

        // If not a page, check if it's a user ID
        try {
          const userRef = ref(rtdb, `users/${cleanId}`);
          const userSnapshot = await get(userRef);

          if (userSnapshot.exists()) {
            router.replace(`/user/${cleanId}`);
            return;
          }

          setContentType('not-found');
          setIsLoading(false);
        } catch (firebaseError) {
          console.error("Error checking user ID in RTDB:", firebaseError);
          // If Firebase fails, assume it's not a user and show not found
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
  }, [id, router, authLoading, currentAccountUid]);

  console.log('🔍 ContentPage: Render state check', {
    isLoading,
    contentType,
    id,
    authLoading,
    currentAccountUid
  });

  if (isLoading) {
    console.log('🔍 ContentPage: Showing SmartLoader because isLoading is true');
    return (
      <SmartLoader
        isLoading={isLoading}
        message="Loading content..."
        timeoutMs={10000}
        autoRecover={true}
        onRetry={() => window.location.reload()}
        fallbackContent={
          <div>
            <p>Loading page content...</p>
          </div>
        }
      />
    );
  }

  if (contentType === 'page') {
    console.log('🔍 ContentPage: Rendering SafePageView for ID:', id);
    return (
      <ClientOnlyPageWrapper>
        <SafePageView params={{ id }} />
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
    <SmartLoader
      isLoading={true}
      message="Loading content..."
      timeoutMs={10000}
      autoRecover={true}
      onRetry={() => window.location.reload()}
      fallbackContent={
        <div>
          <p>We're having trouble loading this content.</p>
        </div>
      }
    />
  );
}