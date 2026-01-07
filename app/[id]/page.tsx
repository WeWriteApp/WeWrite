import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { Metadata } from 'next';
import ContentPageClient from './ContentPageClient';
import { ContentPageSkeleton } from '../components/pages/ContentPageSkeleton';
import ServerContentForSEO from '../components/seo/ServerContentForSEO';
import { extractTextContent } from '../utils/text-extraction';

// ISR: Revalidate pages every 60 seconds for better cache hit rate
// Pages are served from cache and revalidated in background
export const revalidate = 60;

// Allow dynamic params (page IDs)
export const dynamicParams = true;

// Server-side page data fetching
async function getPageData(pageId: string, userId?: string | null) {
  try {
    // Build the API URL - use absolute URL for server-side fetch
    // CRITICAL: Use NEXT_PUBLIC_APP_URL which should be the canonical production URL
    // VERCEL_URL gives deployment-specific URLs which may not work correctly
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                    'https://www.getwewrite.app';

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
      // For non-404 errors, fall back to client-side fetching
      // This prevents SSR issues from blocking page loads
      return { status: 'client-fetch' as const, pageId };
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
    // SSR fetch failed - fall back to client-side fetching
    // This is non-fatal; the client will fetch the data
    return { status: 'client-fetch' as const, pageId };
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
      title: 'New Page',
    };
  }

  try {
    const userId = await getUserIdFromCookies();
    const result = await getPageData(id, userId);

    if (result.status === 'success' && result.pageData) {
      const title = result.pageData.title || 'Untitled';
      // Use proper text extraction for better meta descriptions
      const fullText = extractTextContent(result.pageData.content);
      // Get a compelling description: prefer first sentence, fallback to truncated text
      const firstSentence = fullText.match(/^[^.!?]+[.!?]/)?.[0] || '';
      const description = firstSentence.length >= 50 && firstSentence.length <= 160
        ? firstSentence
        : fullText.slice(0, 157) + (fullText.length > 157 ? '...' : '');
      const canonicalUrl = `https://www.getwewrite.app/${id}`;

      return {
        title: title,
        description: description || `Read "${title}" on WeWrite`,
        alternates: {
          canonical: canonicalUrl,
        },
        openGraph: {
          title: title,
          description: description || `Read "${title}" on WeWrite`,
          type: 'article',
          url: canonicalUrl,
        },
        twitter: {
          card: 'summary_large_image',
          title: title,
          description: description || `Read "${title}" on WeWrite`,
        },
      };
    }
  } catch {
    // Fall back to default metadata
  }

  return {
    title: 'Page',
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

  // SSR fetch failed - let client fetch the data
  // This gracefully handles SSR issues without showing errors to users
  if (result.status === 'client-fetch') {
    return (
      <Suspense fallback={<ContentPageSkeleton />}>
        <ContentPageClient
          pageId={id}
          initialStatus="page"
        />
      </Suspense>
    );
  }

  // Success - render with pre-fetched data
  // Include ServerContentForSEO for search engine crawlers that don't execute JS
  const pageData = result.pageData;

  return (
    <>
      {/* Server-rendered content for SEO crawlers */}
      {pageData && (
        <ServerContentForSEO
          title={pageData.title || 'Untitled'}
          content={pageData.content}
          authorUsername={pageData.authorUsername || pageData.username}
          createdAt={pageData.created?.toDate?.()?.toISOString() || pageData.created}
          lastModified={pageData.lastModified?.toDate?.()?.toISOString() || pageData.lastModified}
          pageId={id}
          // Engagement stats for Schema.org interactionStatistic
          viewCount={pageData.viewCount || pageData.views}
          sponsorCount={pageData.sponsorCount}
          replyCount={pageData.replyCount}
        />
      )}

      {/* Interactive client component */}
      <Suspense fallback={<ContentPageSkeleton />}>
        <ContentPageClient
          pageId={id}
          initialStatus="page"
          initialPageData={pageData}
        />
      </Suspense>
    </>
  );
}
