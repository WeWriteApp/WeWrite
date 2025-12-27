"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import ClientOnlyPageWrapper from '../components/pages/ClientOnlyPageWrapper';
import FullPageError from '../components/ui/FullPageError';
import PageDeletedView from '../components/pages/PageDeletedView';
import UnifiedLoader from '../components/ui/unified-loader';
import { useAuth } from '../providers/AuthProvider';

// Optimized PageView with preloading
const ContentPageView = dynamic(() => import('../components/pages/ContentPageView'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-background">
      <div className="p-5 md:p-4">
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

// Preload ContentPageView on client
if (typeof window !== 'undefined') {
  import('../components/pages/ContentPageView');
}

// Error boundary for ContentPageView
class ContentPageViewErrorBoundary extends React.Component<
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
    // Error boundary caught an error - handled by showing fallback UI
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

interface ContentPageClientProps {
  pageId: string;
  initialStatus: 'page' | 'not-found' | 'deleted' | 'error' | 'new-page';
  initialPageData?: any;
  pageTitle?: string;
  isNewPage?: boolean;
  isDeletedPreview?: boolean;
  shouldCheckUser?: boolean;
}

export default function ContentPageClient({
  pageId,
  initialStatus,
  initialPageData,
  pageTitle,
  isNewPage,
  isDeletedPreview,
  shouldCheckUser
}: ContentPageClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [status, setStatus] = useState(initialStatus);
  const [title, setTitle] = useState(pageTitle || '');

  // Handle new:title format - redirect to /new
  useEffect(() => {
    if (pageId.startsWith('new:')) {
      const extractedTitle = pageId.substring(4);
      if (extractedTitle) {
        router.replace(`/new?title=${encodeURIComponent(extractedTitle)}`);
      } else {
        router.replace('/new');
      }
    }
  }, [pageId, router]);

  // Check if not-found ID might be a user ID
  useEffect(() => {
    if (shouldCheckUser && status === 'not-found') {
      const checkUser = async () => {
        try {
          const response = await fetch(`/api/users/${pageId}/check`, {
            method: 'HEAD',
          });
          if (response.ok) {
            router.replace(`/u/${pageId}`);
          }
        } catch (error) {
          // Failed to check user ID - non-fatal
        }
      };
      checkUser();
    }
  }, [shouldCheckUser, status, pageId, router]);

  // Handle deleted state - redirect to search with the page title
  useEffect(() => {
    if (status === 'deleted' && title) {
      // Redirect to search with the deleted page's title
      const searchQuery = encodeURIComponent(title);
      router.replace(`/search?q=${searchQuery}&deleted=true`);
    }
  }, [status, title, router]);

  // Show a brief loading state while redirecting for deleted pages
  if (status === 'deleted') {
    if (title) {
      // Redirecting to search - show minimal loader
      return (
        <UnifiedLoader
          isLoading={true}
          message={`Searching for "${title}"...`}
        />
      );
    }
    // No title available - show the full deleted view as fallback
    return (
      <PageDeletedView
        pageTitle={title || 'Untitled'}
        pageId={pageId}
      />
    );
  }

  // Handle not-found state
  if (status === 'not-found') {
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

  // Handle error state
  if (status === 'error') {
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

  // Handle page state (including new-page)
  if (status === 'page' || status === 'new-page') {
    return (
      <ClientOnlyPageWrapper>
        <ContentPageViewErrorBoundary pageId={pageId}>
          <ContentPageView
            params={{ id: pageId }}
            initialPageData={initialPageData}
          />
        </ContentPageViewErrorBoundary>
      </ClientOnlyPageWrapper>
    );
  }

  // Fallback loading state
  return (
    <UnifiedLoader
      isLoading={true}
      message="Loading content..."
      onRetry={() => window.location.reload()}
    />
  );
}
