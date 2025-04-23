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
  '/': 'Home Page',
  '/new': 'Create New Page',
  '/direct-create': 'Direct Create Page',
  '/direct-reply': 'Direct Reply Page',
  '/activity': 'Activity Feed',
  '/search': 'Search Page',
  '/leaderboard': 'Leaderboard',
  '/subscription': 'Subscription Page',
  '/account': 'Account Settings',

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
  '/account/profile': 'Profile Settings',
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
  // 1. Check if we have a predefined title for this path
  if (PAGE_TITLE_MAP[pathname]) {
    return PAGE_TITLE_MAP[pathname];
  }

  // 2. Handle dynamic routes with specific patterns

  // User profile pages
  if (pathname.startsWith('/user/')) {
    const username = document.querySelector('h1')?.textContent;
    if (username) {
      return `User Profile: ${username}`;
    }

    // Extract username from URL as fallback
    const usernameFromPath = pathname.split('/').pop();
    return `User Profile: ${usernameFromPath}`;
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

    // Try to get the page title from the DOM
    const contentTitle = document.querySelector('h1')?.textContent;
    if (contentTitle && contentTitle !== 'Untitled') {
      return `Page: ${contentTitle}`;
    }

    // Check if we have this page title in our cache
    if (pageTitleCache.has(pageId)) {
      return `Page: ${pageTitleCache.get(pageId)}`;
    }

    // If we're in a browser environment, try to fetch the title asynchronously
    if (typeof window !== 'undefined') {
      // Return the ID temporarily but trigger an async fetch
      fetchAndCachePageTitle(pageId);
      return `Page: ${pageId}`;
    }

    // Fallback to just the ID
    return `Page: ${pageId}`;
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
async function fetchAndCachePageTitle(pageId: string): Promise<void> {
  try {
    // Skip if we already have this in cache
    if (pageTitleCache.has(pageId)) return;

    // Fetch the page metadata
    const title = await getCachedPageTitle(pageId);

    // Cache the title for future use
    if (title && title !== 'Untitled') {
      pageTitleCache.set(pageId, title);

      // If we have Google Analytics available, send an updated page view
      // This helps correct the page title in GA after we've fetched it
      if (typeof window !== 'undefined' && window.gtag) {
        const pathname = window.location.pathname;
        const pageTitle = `Page: ${title}`;

        window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '', {
          page_path: pathname,
          page_title: pageTitle,
          page_location: window.location.href
        });

        console.log('Updated analytics with fetched page title:', pageTitle);
      }
    }
  } catch (error) {
    console.error('Error fetching page title for analytics:', error);
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
    // Check cache first
    if (pageTitleCache.has(pageId)) {
      return `Page: ${pageTitleCache.get(pageId)}`;
    }

    // Fetch from database
    const metadata = await getPageMetadata(pageId);
    if (metadata?.title) {
      // Cache for future use
      pageTitleCache.set(pageId, metadata.title);
      return `Page: ${metadata.title}`;
    }
  } catch (error) {
    console.error('Error fetching page title for analytics:', error);
  }

  return `Page: ${pageId}`;
}
