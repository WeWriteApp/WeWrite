import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { Metadata } from 'next';
import ContentPageClient from './ContentPageClient';
import { ContentPageSkeleton } from '../components/pages/ContentPageSkeleton';

// ISR: Revalidate pages every 60 seconds for better cache hit rate
// Pages are served from cache and revalidated in background
export const revalidate = 60;

// Allow dynamic params (page IDs)
export const dynamicParams = true;

// Server-side page data fetching
async function getPageData(pageId: string, userId?: string | null) {
  try {
    // Build the API URL - use absolute URL for server-side fetch
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                    'http://localhost:3000';

    const url = new URL(`/api/pages/${pageId}`, baseUrl);
    if (userId) {
      url.searchParams.set('userId', userId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Cache-Control': 'no-cache',
      },
      // Use Next.js cache with revalidation
      next: { revalidate: 60 }
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Try to get error body for deleted page check
        try {
          const errorData = await response.json();
          if (errorData?.pageData?.deleted === true) {
            return {
              status: 'deleted' as const,
              pageTitle: errorData.pageData.title || 'Deleted Page',
              pageId
            };
          }
        } catch {
          // Ignore parse errors
        }
        return { status: 'not-found' as const, pageId };
      }
      return { status: 'error' as const, pageId };
    }

    const data = await response.json();

    if (data.pageData?.deleted === true) {
      return {
        status: 'deleted' as const,
        pageTitle: data.pageData.title || 'Deleted Page',
        pageId
      };
    }

    return {
      status: 'success' as const,
      pageData: data.pageData,
      pageId
    };
  } catch (error) {
    console.error('[Page SSR] Error fetching page:', error);
    return { status: 'error' as const, pageId };
  }
}

// Get user ID from cookies (server-side)
async function getUserIdFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('simpleUserSession');

    if (sessionCookie?.value) {
      const session = JSON.parse(sessionCookie.value);
      return session.uid || null;
    }
  } catch {
    // Ignore cookie parsing errors
  }
  return null;
}

// Generate metadata for the page (SEO)
export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params;

  // Skip metadata fetch for special routes
  if (id === 'new' || id.startsWith('new:')) {
    return {
      title: 'New Page | WeWrite',
    };
  }

  try {
    const userId = await getUserIdFromCookies();
    const result = await getPageData(id, userId);

    if (result.status === 'success' && result.pageData) {
      const title = result.pageData.title || 'Untitled';
      const description = result.pageData.content?.[0]?.children?.[0]?.text?.slice(0, 160) || '';

      return {
        title: `${title} | WeWrite`,
        description: description || `Read "${title}" on WeWrite`,
        openGraph: {
          title: title,
          description: description || `Read "${title}" on WeWrite`,
          type: 'article',
        },
      };
    }
  } catch {
    // Fall back to default metadata
  }

  return {
    title: 'Page | WeWrite',
  };
}

// Main page component (Server Component)
export default async function ContentPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const search = await searchParams;

  // Handle new page creation - skip server fetch, go straight to client
  const isNewPage = search.new === 'true' || search.draft === 'true';
  const isNewFromLink = id.startsWith('new:');

  if (isNewPage || isNewFromLink) {
    return (
      <Suspense fallback={<ContentPageSkeleton />}>
        <ContentPageClient
          pageId={id}
          initialStatus="new-page"
          isNewPage={true}
        />
      </Suspense>
    );
  }

  // Handle deleted page preview
  if (search.preview === 'deleted') {
    return (
      <Suspense fallback={<ContentPageSkeleton />}>
        <ContentPageClient
          pageId={id}
          initialStatus="page"
          isDeletedPreview={true}
        />
      </Suspense>
    );
  }

  // Get user ID for permission checks
  const userId = await getUserIdFromCookies();

  // Fetch page data on server (with ISR caching)
  const result = await getPageData(id, userId);

  // Handle different states
  if (result.status === 'not-found') {
    // Check if this might be a user ID - let client handle redirect
    return (
      <Suspense fallback={<ContentPageSkeleton />}>
        <ContentPageClient
          pageId={id}
          initialStatus="not-found"
          shouldCheckUser={true}
        />
      </Suspense>
    );
  }

  if (result.status === 'deleted') {
    return (
      <Suspense fallback={<ContentPageSkeleton />}>
        <ContentPageClient
          pageId={id}
          initialStatus="deleted"
          pageTitle={result.pageTitle}
        />
      </Suspense>
    );
  }

  if (result.status === 'error') {
    return (
      <Suspense fallback={<ContentPageSkeleton />}>
        <ContentPageClient
          pageId={id}
          initialStatus="error"
        />
      </Suspense>
    );
  }

  // Success - render with pre-fetched data
  return (
    <Suspense fallback={<ContentPageSkeleton />}>
      <ContentPageClient
        pageId={id}
        initialStatus="page"
        initialPageData={result.pageData}
      />
    </Suspense>
  );
}
