'use client';

/**
 * Utility for standardized page title naming in analytics
 *
 * This ensures consistent page naming across all analytics providers
 * and reduces the number of "(other)" pages in Google Analytics.
 *
 * Updated to ensure human-readable page titles in reports.
 */

import { getPageMetadata, getCachedPageTitle } from '../firebase/database';
import { auth } from '../firebase/auth';

// Cache for page titles to avoid excessive database queries
const pageTitleCache = new Map<string, string>();

/**
 * Extract a page ID from a URL path
 *
 * @param path - The URL path to extract from
 * @returns The extracted page ID or null if not found
 */
export function extractPageIdFromPath(path: string): string | null {
  if (!path) return null;

  // Check for /pages/[id] format
  const pagesMatch = path.match(/\/pages\/([a-zA-Z0-9-_]+)/);
  if (pagesMatch && pagesMatch[1]) return pagesMatch[1];

  // Check for direct UUID format (20 chars)
  const uuidMatch = path.match(/\/([a-zA-Z0-9]{20})(?:\/|$)/);
  if (uuidMatch && uuidMatch[1]) return uuidMatch[1];

  return null;
}

// Map of static page routes to descriptive titles
export const PAGE_TITLE_MAP: Record<string, string> = {
  // Main navigation
  // Note: Home page ('/') is handled dynamically based on auth state
  '/new': 'New Page',
  '/activity': 'Activity Feed',
  '/search': 'Search Page',
  '/leaderboard': 'Leaderboard',
  '/subscription': 'Subscription Page',

  // Auth pages
  '/auth/login': 'Login Page',
  '/auth/register': 'Registration Page',
  '/auth/forgot-password': 'Password Reset Page',
  '/auth/switch-account': 'Account Switcher',
  '/auth/logout': 'Logout Page',

  // Account pages
  '/account': 'Account Settings',
  '/account/subscription': 'Subscription Settings',
  '/account/payment': 'Payment Settings',
  '/account/notifications': 'Notification Settings',
  '/account/security': 'Security Settings',

  // Other static pages
  '/sandbox': 'Sandbox Page',
  '/terms': 'Terms of Service',
  '/privacy': 'Privacy Policy',
  '/about': 'About Page',
  '/contact': 'Contact Page',
  '/help': 'Help Center',
  '/faq': 'FAQ Page'
};

/**
 * Get a standardized page title for analytics
 *
 * @param pathname - The current path
 * @param searchParams - URL search parameters
 * @param documentTitle - Current document.title (optional)
 * @returns Standardized page title for analytics
 */
export function getAnalyticsPageTitle(
  pathname: string,
  searchParams?: URLSearchParams | null,
  documentTitle?: string
): string {
  // Special case for home page - differentiate between logged-in and logged-out states
  if (pathname === '/') {
    // Check Firebase auth
    const currentUser = auth.currentUser;

    // Also check localStorage as a fallback in case Firebase auth isn't fully initialized
    const hasLocalStorageAuth = typeof window !== 'undefined' &&
      (localStorage.getItem('authState') === 'authenticated' ||
       document.cookie.includes('authenticated=true'));

    if (!currentUser && !hasLocalStorageAuth) {
      return "Landing";
    } else {
      return "Home";
    }
  }

  // For other paths, check if we have a predefined title
  if (PAGE_TITLE_MAP[pathname]) {
    return PAGE_TITLE_MAP[pathname];
  }

  // 2. Handle dynamic routes with specific patterns

  // User profile pages
  if (pathname.startsWith('/user/')) {
    const username = document.querySelector('h1')?.textContent;
    if (username) {
      return `User: ${username}`;
    }

    // Extract username from URL as fallback
    const usernameFromPath = pathname.split('/').pop();
    return `User: ${usernameFromPath}`;
  }

  // Group pages
  if (pathname.startsWith('/g/')) {
    const groupName = document.querySelector('h1')?.textContent;
    if (groupName) {
      return `Group: ${groupName}`;
    }

    // Extract group ID from URL as fallback
    const groupId = pathname.split('/').pop();
    return `Group: ${groupId}`;
  }

  // Content pages (using UUID pattern or /pages/ path)
  const pageId = extractPageIdFromPath(pathname);
  if (pageId) {
    // Check if we're in edit mode
    if (searchParams?.has('edit')) {
      return 'Page Editor';
    }

    // Try to get the page title from the DOM first (most accurate)
    const contentTitle = document.querySelector('h1')?.textContent;
    if (contentTitle && contentTitle !== 'Untitled') {
      // Cache this title for future use
      pageTitleCache.set(pageId, contentTitle);
      return `Page: ${contentTitle}`;
    }

    // Check if we have this page title in our cache
    if (pageTitleCache.has(pageId)) {
      return `Page: ${pageTitleCache.get(pageId)}`;
    }

    // Check document title for page name
    if (documentTitle &&
        documentTitle !== 'WeWrite' &&
        documentTitle !== 'Untitled' &&
        !documentTitle.includes('undefined')) {
      // Clean up the document title
      let cleanTitle = documentTitle;

      // Remove "WeWrite - " prefix if present
      if (cleanTitle.startsWith('WeWrite - ')) {
        cleanTitle = cleanTitle.substring('WeWrite - '.length);
      }

      // Remove " by username on WeWrite" suffix if present
      const bySuffix = " by ";
      const onWeWriteSuffix = " on WeWrite";
      if (cleanTitle.includes(bySuffix)) {
        cleanTitle = cleanTitle.substring(0, cleanTitle.indexOf(bySuffix));
      } else if (cleanTitle.includes(onWeWriteSuffix)) {
        cleanTitle = cleanTitle.substring(0, cleanTitle.indexOf(onWeWriteSuffix));
      }

      if (cleanTitle && cleanTitle !== 'Untitled') {
        // Cache this title for future use
        pageTitleCache.set(pageId, cleanTitle);
        return `Page: ${cleanTitle}`;
      }
    }

    // If we're in a browser environment, try to fetch the title asynchronously
    if (typeof window !== 'undefined') {
      // Trigger an async fetch to get the actual title
      fetchAndCachePageTitle(pageId);

      // Try to get a better fallback from the URL path
      const pathSegments = pathname.split('/').filter(Boolean);
      if (pathSegments.length > 0) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (lastSegment === pageId && pathSegments.length > 1) {
          // Use the previous path segment as a category
          const category = pathSegments[pathSegments.length - 2]
            .charAt(0).toUpperCase() +
            pathSegments[pathSegments.length - 2].slice(1);
          return `Page: ${pageId.substring(0, 6)}...`;
        }
      }

      // Look for any heading element as a last resort - expanded search
      // Try multiple selectors to find any possible title in the DOM
      const selectors = [
        'h1', 'h2', 'h3',
        '[data-page-title]',
        '.page-title',
        'title',
        'meta[property="og:title"]'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        let text = null;

        if (element) {
          // Handle different element types
          if (selector === 'meta[property="og:title"]') {
            text = element.getAttribute('content');
          } else if (selector === 'title') {
            text = element.textContent;
            // Clean up title text
            if (text && text.includes(' - WeWrite')) {
              text = text.split(' - WeWrite')[0];
            }
          } else {
            text = element.textContent;
          }

          if (text && text.trim() !== '' && text !== 'Untitled') {
            console.log(`Found page title using selector ${selector}: ${text}`);
            return `Page: ${text}`;
          }
        }
      }

      // If we still don't have a title, use a more descriptive fallback
      // This indicates it's loading rather than being generic "Content"
      return `Page: Loading...`;
    }

    // Fallback to a better generic title instead of showing the ID
    return `Page: Loading...`;
  }

  // 3. Use document title if available and meaningful
  if (documentTitle &&
      documentTitle !== 'WeWrite' &&
      documentTitle !== 'Untitled' &&
      !documentTitle.includes('undefined')) {
    // Clean up the document title
    let cleanTitle = documentTitle;

    // Remove "WeWrite - " prefix if present
    if (cleanTitle.startsWith('WeWrite - ')) {
      cleanTitle = cleanTitle.substring('WeWrite - '.length);
    }

    return cleanTitle;
  }

  // 4. Fallback: Extract meaningful name from path
  const pathSegments = pathname.split('/').filter(Boolean);
  if (pathSegments.length > 0) {
    const lastSegment = pathSegments[pathSegments.length - 1];
    // Capitalize and format the last path segment
    const formattedSegment = lastSegment
      .charAt(0).toUpperCase() +
      lastSegment.slice(1)
      .replace(/-/g, ' ');

    return formattedSegment;
  }

  // Ultimate fallback
  return 'Unknown Page';
}

/**
 * Get a standardized page title for a specific page ID
 * This is useful for server-side rendering or when the DOM isn't available
 *
 * @param pageId - The page ID
 * @returns Promise resolving to the page title
 */
/**
 * Fetch a page title from the database and cache it for future use
 * This is called asynchronously when we encounter a page without a title in the DOM
 *
 * @param pageId - The page ID to fetch the title for
 */
/**
 * Fetch a page title from the database and cache it for future use
 * This is called asynchronously when we encounter a page without a title in the DOM
 *
 * The function will update Google Analytics with the correct title once it's fetched
 *
 * @param pageId - The page ID to fetch the title for
 * @param maxRetries - Maximum number of retries for DOM checks (default: 3)
 */
async function fetchAndCachePageTitle(pageId: string, maxRetries: number = 3): Promise<void> {
  try {
    // Skip if we already have this in cache
    if (pageTitleCache.has(pageId)) {
      const cachedTitle = pageTitleCache.get(pageId);
      console.log(`Using cached title for page ${pageId}: ${cachedTitle}`);
      updateAnalyticsWithTitle(pageId, cachedTitle);
      return;
    }

    // First, try to get the title from the DOM again
    // This helps in cases where the DOM wasn't fully loaded during the initial check
    if (typeof window !== 'undefined' && maxRetries > 0) {
      // Try multiple selectors to find any possible title in the DOM
      const selectors = [
        'h1', 'h2', 'h3',
        '[data-page-title]',
        '.page-title',
        'title',
        'meta[property="og:title"]'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        let text = null;

        if (element) {
          // Handle different element types
          if (selector === 'meta[property="og:title"]') {
            text = element.getAttribute('content');
          } else if (selector === 'title') {
            text = element.textContent;
            // Clean up title text
            if (text && text.includes(' - WeWrite')) {
              text = text.split(' - WeWrite')[0];
            }
          } else {
            text = element.textContent;
          }

          if (text && text.trim() !== '' && text !== 'Untitled') {
            console.log(`Found page title in DOM retry using selector ${selector}: ${text}`);
            pageTitleCache.set(pageId, text);
            updateAnalyticsWithTitle(pageId, text);
            return;
          }
        }
      }

      // If we still don't have a title from DOM, wait a bit and retry
      // This helps with slow-loading pages
      if (maxRetries > 1) {
        console.log(`No title found in DOM yet for ${pageId}, will retry in 500ms (${maxRetries-1} retries left)`);
        setTimeout(() => {
          fetchAndCachePageTitle(pageId, maxRetries - 1);
        }, 500);
        return;
      }
    }

    // Try to get the page metadata directly from the database
    try {
      console.log(`Fetching metadata from database for page ${pageId}`);
      const metadata = await getPageMetadata(pageId);
      if (metadata && metadata.title && metadata.title !== 'Untitled') {
        // We have a valid title from metadata
        console.log(`Got title from metadata for page ${pageId}: ${metadata.title}`);
        pageTitleCache.set(pageId, metadata.title);
        updateAnalyticsWithTitle(pageId, metadata.title);
        return;
      } else {
        console.log(`No valid title found in metadata for page ${pageId}`);
      }
    } catch (metadataError) {
      console.error('Error fetching page metadata:', metadataError);
    }

    // If direct metadata fetch failed, try the cached title approach
    console.log(`Trying getCachedPageTitle for page ${pageId}`);
    const title = await getCachedPageTitle(pageId);

    // Cache the title for future use
    if (title && title !== 'Untitled') {
      console.log(`Got title from getCachedPageTitle for page ${pageId}: ${title}`);
      pageTitleCache.set(pageId, title);
      updateAnalyticsWithTitle(pageId, title);
    } else {
      // Even if we couldn't get a good title, update GA with a better generic title
      console.log(`No valid title found for page ${pageId}, using fallback`);

      // Try to get a better fallback from the URL path
      let fallbackTitle = 'Page';
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname;
        const pathSegments = pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          const lastSegment = pathSegments[pathSegments.length - 1];
          if (lastSegment === pageId && pathSegments.length > 1) {
            // Use the previous path segment as a category
            const category = pathSegments[pathSegments.length - 2]
              .charAt(0).toUpperCase() +
              pathSegments[pathSegments.length - 2].slice(1);
            fallbackTitle = category;
          }
        }
      }

      updateAnalyticsWithTitle(pageId, `${pageId.substring(0, 6)}...`);
    }
  } catch (error) {
    console.error('Error fetching page title for analytics:', error);
  }
}

/**
 * Helper function to update Google Analytics with the correct page title
 * Exported so it can be called from other components when page titles are loaded
 *
 * @param pageId - The page ID
 * @param title - The page title to use
 */
export function updateAnalyticsWithTitle(pageId: string, title: string): void {
  if (typeof window === 'undefined' || !window.gtag) return;

  const pathname = window.location.pathname;
  const pageTitle = `Page: ${title}`;

  // Update Google Analytics with the correct title
  window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '', {
    page_path: pathname,
    page_title: pageTitle,
    page_location: window.location.href
  });

  console.log(`Updated analytics for page ${pageId} with title: ${pageTitle}`);

  // If we have other analytics providers, update them too
  try {
    if (window.analytics && typeof window.analytics.pageView === 'function') {
      window.analytics.pageView(pathname, pageTitle);
      console.log(`Updated unified analytics with title: ${pageTitle}`);
    }

    if (window.ReactGA && typeof window.ReactGA.send === 'function') {
      window.ReactGA.send({
        hitType: "pageview",
        page: pathname,
        title: pageTitle
      });
      console.log(`Updated ReactGA with title: ${pageTitle}`);
    }
  } catch (analyticsError) {
    console.error('Error updating additional analytics providers:', analyticsError);
  }
}

/**
 * Get a standardized page title for a specific page ID
 * This is useful for server-side rendering or when the DOM isn't available
 *
 * @param pageId - The page ID
 * @returns Promise resolving to the page title
 */
export async function getAnalyticsPageTitleForId(pageId: string): Promise<string> {
  try {
    console.log(`Getting analytics page title for ID: ${pageId}`);

    // Check cache first
    if (pageTitleCache.has(pageId)) {
      const cachedTitle = pageTitleCache.get(pageId);
      console.log(`Using cached title for page ${pageId}: ${cachedTitle}`);
      return `Page: ${cachedTitle}`;
    }

    // Fetch from database
    console.log(`Fetching metadata for page ${pageId}`);
    const metadata = await getPageMetadata(pageId);
    if (metadata?.title && metadata.title !== 'Untitled') {
      // Cache for future use
      console.log(`Got title from metadata for page ${pageId}: ${metadata.title}`);
      pageTitleCache.set(pageId, metadata.title);

      // If we're in the browser, update analytics with the correct title
      if (typeof window !== 'undefined') {
        updateAnalyticsWithTitle(pageId, metadata.title);
      }

      return `Page: ${metadata.title}`;
    } else {
      console.log(`No valid title found in metadata for page ${pageId}`);
    }

    // Try the cached title approach as a fallback
    console.log(`Trying getCachedPageTitle for page ${pageId}`);
    const title = await getCachedPageTitle(pageId);
    if (title && title !== 'Untitled') {
      console.log(`Got title from getCachedPageTitle for page ${pageId}: ${title}`);
      pageTitleCache.set(pageId, title);

      // If we're in the browser, update analytics with the correct title
      if (typeof window !== 'undefined') {
        updateAnalyticsWithTitle(pageId, title);
      }

      return `Page: ${title}`;
    }
  } catch (error) {
    console.error('Error fetching page title for analytics:', error);
  }

  // If we're in the browser, trigger an async fetch to get the title later
  if (typeof window !== 'undefined') {
    console.log(`Triggering async fetch for page ${pageId}`);
    setTimeout(() => {
      fetchAndCachePageTitle(pageId);
    }, 100);
  }

  // Return a better generic title instead of showing the ID
  return `Page: Loading...`;
}
