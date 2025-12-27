'use client';

/**
 * Utility for standardized page title naming in analytics
 *
 * This ensures consistent page naming across all analytics providers
 * and reduces the number of "(other)" pages in Google Analytics.
 *
 * Updated to ensure human-readable page titles in reports.
 */

// REMOVED: Direct Firebase imports - now using API endpoints for cost optimization
import { pageApi } from './apiClient';

// Cache for page titles to avoid excessive database queries
const pageTitleCache = new Map<string, string>();

// Flag to track if we've already sent the initial page view for the current page
// This helps prevent duplicate tracking when we update with better titles
const trackedPages = new Set<string>();

// Store pending analytics updates to avoid race conditions
const pendingAnalyticsUpdates = new Map<string, NodeJS.Timeout>();

/**
 * Strip " | WeWrite" suffix from titles for cleaner analytics
 * Browser tabs can show "Home | WeWrite" but GA should just show "Home"
 */
function stripWeWriteSuffix(title: string): string {
  if (!title) return title;
  // Remove " | WeWrite" suffix (and handle potential duplicates like " | WeWrite | WeWrite")
  return title.replace(/(\s*\|\s*WeWrite)+$/gi, '').trim();
}

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
  '/home': 'Home Feed',
  '/new': 'Create New Page',
  '/create': 'Create New Page',
  '/search': 'Search',
  '/trending': 'Trending Pages',
  '/trending-pages': 'Trending Pages',
  '/leaderboard': 'Leaderboards',
  '/following': 'Following Feed',
  '/recents': 'Recent Pages',
  '/random-pages': 'Random Pages',
  '/notifications': 'Notifications',
  '/users': 'Users Directory',
  '/map': 'Content Map',
  '/timeline': 'Timeline View',
  '/invite': 'Invite Friends',
  '/support': 'Support',
  '/onboarding': 'Onboarding',
  '/welcome': 'Welcome',

  // Auth pages
  '/auth/login': 'Login',
  '/auth/register': 'Register',
  '/auth/forgot-password': 'Forgot Password',
  '/auth/reset-password': 'Reset Password',
  '/auth/logout': 'Logout',
  '/auth/setup-username': 'Setup Username',
  '/auth/verify-email': 'Verify Email',
  '/auth/verify-email-pending': 'Email Verification Pending',
  '/auth/switch-account': 'Switch Account',

  // Settings pages
  '/settings': 'Settings',
  '/settings/profile': 'Profile Settings',
  '/settings/appearance': 'Appearance Settings',
  '/settings/notifications': 'Notification Settings',
  '/settings/advanced': 'Advanced Settings',
  '/settings/deleted': 'Deleted Pages',
  '/settings/earnings': 'Earnings Dashboard',
  '/settings/spend': 'Spending Dashboard',
  '/settings/reset-password': 'Change Password',
  '/settings/email-preferences': 'Email Preferences',
  '/settings/security': 'Security Settings',
  '/settings/subscription': 'Subscription Settings',
  '/settings/subscription/checkout': 'Subscription Checkout',
  '/settings/subscription/success': 'Subscription Success',
  '/settings/fund-account': 'Fund Account',
  '/settings/fund-account/checkout': 'Fund Account Checkout',
  '/settings/fund-account/success': 'Fund Account Success',
  '/settings/fund-account/cancel': 'Fund Account Cancelled',
  '/settings/fund-account/cancelled': 'Fund Account Cancelled',

  // Admin pages
  '/admin': 'Admin Dashboard',
  '/admin/product-kpis': 'Admin Product KPIs',
  '/admin/users': 'Admin: Users',
  '/admin/emails': 'Admin: Emails',
  '/admin/notifications': 'Admin: Notifications',
  '/admin/feature-flags': 'Admin: Feature Flags',
  '/admin/payout-validation': 'Admin: Payout Validation',
  '/admin/financial-tests': 'Admin: Financial Tests',
  '/admin/writing-ideas': 'Admin: Writing Ideas',
  '/admin/monthly-financials': 'Admin: Monthly Financials',
  '/admin/mobile-onboarding': 'Admin: Mobile Onboarding',
  '/admin/background-images': 'Admin: Background Images',
  '/admin/opengraph-images': 'Admin: OpenGraph Images',
  '/admin/design-system': 'Admin: Design System',
  '/admin/broadcast': 'Admin: Broadcast',

  // Monitoring/Testing pages
  '/monitoring/database-reads': 'Monitoring: Database Reads',
  '/test-colors': 'Test: Colors',
  '/auth-test': 'Test: Auth'
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
  // Strip " | WeWrite" from document title before processing
  const cleanDocumentTitle = documentTitle ? stripWeWriteSuffix(documentTitle) : documentTitle;

  // Call internal function and strip suffix from result
  const result = getAnalyticsPageTitleInternal(pathname, searchParams, cleanDocumentTitle);
  return stripWeWriteSuffix(result);
}

function getAnalyticsPageTitleInternal(
  pathname: string,
  searchParams?: URLSearchParams | null,
  documentTitle?: string
): string {
  // Special case for home page - differentiate between logged-in and logged-out states
  if (pathname === '/') {
    // Check localStorage/cookies for auth state (Firebase auth may not be initialized)
    const hasLocalStorageAuth = typeof window !== 'undefined' &&
      (localStorage.getItem('authState') === 'authenticated' ||
       document.cookie.includes('authenticated=true'));

    if (!hasLocalStorageAuth) {
      return "Landing Page";
    } else {
      return "Home Feed";
    }
  }

  // For other paths, check if we have a predefined title
  if (PAGE_TITLE_MAP[pathname]) {
    return PAGE_TITLE_MAP[pathname];
  }

  // 2. Handle dynamic routes with specific patterns

  // User profile pages
  if (pathname.startsWith('/user/')) {
    // Try to get the username from the DOM first (most accurate)
    const username = document.querySelector('h1')?.textContent;
    if (username) {
      return `User: ${username}`;
    }

    // Try to get username from document title
    if (documentTitle && documentTitle.includes(' on WeWrite')) {
      const displayName = documentTitle.split(' on WeWrite')[0];
      if (displayName && displayName !== 'WeWrite') {
        return `User: ${displayName}`;
      }
    }

    // Try to get username from a specific element with user data
    const userElement = document.querySelector('[data-username]');
    if (userElement) {
      const dataUsername = userElement.getAttribute('data-username');
      if (dataUsername) {
        return `User: ${dataUsername}`;
      }
    }

    // Extract username from URL as fallback
    const userId = pathname.split('/').pop();

    // If it looks like a user ID (not a username), try to find a better display
    if (userId && userId.length > 10) {
      // Look for any username display in the page
      const usernameDisplay = document.querySelector('.username, [data-user-profile-name]');
      if (usernameDisplay && usernameDisplay.textContent) {
        return `User: ${usernameDisplay.textContent.trim()}`;
      }
    }

    return `User: ${userId}`;
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

  // Handle /u/[username] profile pages
  if (pathname.startsWith('/u/')) {
    const username = pathname.split('/')[2];
    if (username) {
      return `User: ${username}`;
    }
    return 'User Profile';
  }

  // Handle email preferences with token
  if (pathname.startsWith('/email-preferences/')) {
    return 'Email Preferences';
  }

  // Handle welcome vertical pages
  if (pathname.startsWith('/welcome/')) {
    const vertical = pathname.split('/')[2];
    if (vertical) {
      // Capitalize and format the vertical name
      const formattedVertical = vertical
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return `Welcome: ${formattedVertical}`;
    }
    return 'Welcome';
  }

  // ContentPages (using UUID pattern or /pages/ path)
  const pageId = extractPageIdFromPath(pathname);
  if (pageId) {
    // Check for version history page
    if (pathname.includes('/versions')) {
      return 'Page Version History';
    }

    // Check for specific version view
    if (pathname.includes('/version/')) {
      return 'Page Version View';
    }

    // Check for diff view
    if (pathname.includes('/diff/')) {
      return 'Page Diff View';
    }

    // Check for location pages
    if (pathname.includes('/location/view')) {
      return 'Page Location View';
    }
    if (pathname.includes('/location')) {
      return 'Page Location';
    }

    // Check if we're in edit mode
    if (searchParams?.has('edit')) {
      return 'Page Editor';
    }

    // Try to get the page title and author from the DOM first (most accurate)
    const contentTitle = document.querySelector('h1')?.textContent;
    let username: string | null = null;

    // Try to extract username from document title
    if (documentTitle && documentTitle.includes(' by ')) {
      const parts = documentTitle.split(' by ');
      if (parts.length >= 2) {
        const authorPart = parts[1];
        const extractedUsername = authorPart.split(' on WeWrite')[0];

        // Skip "Anonymous" usernames - we'll try to get a better one later
        if (extractedUsername !== 'Anonymous') {
          username = extractedUsername;
        }
      }
    }

    // Check if this is a group page
    const groupElement = document.querySelector('[data-group-name]');
    const groupName = groupElement ? groupElement.getAttribute('data-group-name') || groupElement.textContent : null;
    const hasGroup = groupName && groupName !== 'Unknown';

    // If we have both title and group name
    if (contentTitle && contentTitle !== 'Untitled' && hasGroup) {
      // Cache this title for future use
      pageTitleCache.set(pageId, contentTitle);
      return `Page: ${contentTitle} in ${groupName}`;
    }

    // If we have both title and username from DOM/document title
    if (contentTitle && contentTitle !== 'Untitled' && username) {
      // Cache this title for future use
      pageTitleCache.set(pageId, contentTitle);
      return `Page: ${contentTitle} by ${username}`;
    }

    // If we have just the title from DOM
    if (contentTitle && contentTitle !== 'Untitled') {
      // Cache this title for future use
      pageTitleCache.set(pageId, contentTitle);

      // First try to find group name in the page
      const groupElement = document.querySelector('[data-group-name]');
      if (groupElement) {
        const groupName = groupElement.getAttribute('data-group-name') || groupElement.textContent;

        // Skip "Unknown" group names
        if (groupName && groupName !== 'Unknown') {
          return `Page: ${contentTitle} in ${groupName}`;
        }
      }

      // If no group, try to find username in the page
      const authorElement = document.querySelector('[data-author-username]');
      if (authorElement) {
        const extractedUsername = authorElement.getAttribute('data-author-username') ||
                  authorElement.textContent;

        // Skip "Anonymous" usernames
        if (extractedUsername && extractedUsername !== 'Anonymous' && extractedUsername !== 'Missing username') {
          username = extractedUsername;
          return `Page: ${contentTitle} by ${username}`;
        }
      }

      // If we couldn't find a valid username, try to get it from the page data
      try {
        // Attempt to find user ID in the DOM
        const userIdElement = document.querySelector('[data-author-id]');
        if (userIdElement) {
          const userId = userIdElement.getAttribute('data-author-id');
          if (userId) {
            // We'll return the title without username for now, but trigger an async fetch
            // to update the analytics later with the correct username
            setTimeout(async () => {
              try {
                const { getUsernameById } = await import('../utils/userUtils');
                const fetchedUsername = await getUsernameById(userId);

                if (fetchedUsername && fetchedUsername !== 'Anonymous' && fetchedUsername !== 'Missing username') {
                  // Update analytics with the correct username
                  if (typeof window !== 'undefined' && window.gtag) {
                    window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '', {
                      page_path: window.location.pathname,
                      page_title: `Page: ${contentTitle} by ${fetchedUsername}`,
                      page_location: window.location.href
                    });
                  }
                }
              } catch (error) {
                // Failed to fetch username - non-fatal
              }
            }, 500);
          }
        }
      } catch (error) {
        // Failed to get username from page data - non-fatal
      }

      return `Page: ${contentTitle}`;
    }

    // Check if we have this page title in our cache
    if (pageTitleCache.has(pageId)) {
      const cachedTitle = pageTitleCache.get(pageId);

      // First try to find group name in the page
      const groupElement = document.querySelector('[data-group-name]');
      if (groupElement) {
        const groupName = groupElement.getAttribute('data-group-name') || groupElement.textContent;

        // Skip "Unknown" group names
        if (groupName && groupName !== 'Unknown') {
          return `Page: ${cachedTitle} in ${groupName}`;
        }
      }

      // If no group, try to find username in the page
      const authorElement = document.querySelector('[data-author-username]');
      if (authorElement) {
        const extractedUsername = authorElement.getAttribute('data-author-username') ||
                  authorElement.textContent;
        if (extractedUsername) {
          username = extractedUsername;
          return `Page: ${cachedTitle} by ${username}`;
        }
      }

      return `Page: ${cachedTitle}`;
    }

    // Check document title for page name
    if (documentTitle &&
        documentTitle !== 'WeWrite' &&
        documentTitle !== 'Untitled' &&
        !documentTitle.includes('undefined')) {
      // Clean up the document title
      let cleanTitle = documentTitle;
      let extractedUsername: string | null = null;
      let extractedGroupName: string | null = null;

      // Remove "WeWrite - " prefix if present
      if (cleanTitle.startsWith('WeWrite - ')) {
        cleanTitle = cleanTitle.substring('WeWrite - '.length);
      }

      // Extract group name if present in " in groupName on WeWrite" format
      const inSuffix = " in ";
      // Extract username if present in " by username on WeWrite" format
      const bySuffix = " by ";
      const onWeWriteSuffix = " on WeWrite";
      const taglineSuffix = " - The social wiki where every page is a fundraiser";

      // First, remove the tagline if present
      if (cleanTitle.includes(taglineSuffix)) {
        cleanTitle = cleanTitle.replace(taglineSuffix, '');
      }

      // Then extract group name or username if present
      if (cleanTitle.includes(inSuffix)) {
        // Format: "[pagename] in [groupName] on WeWrite"
        const titleParts = cleanTitle.split(inSuffix);
        cleanTitle = titleParts[0];
        if (titleParts.length > 1) {
          extractedGroupName = titleParts[1].split(onWeWriteSuffix)[0];
        }
      } else if (cleanTitle.includes(bySuffix)) {
        // Format: "[pagename] by [username] on WeWrite"
        const titleParts = cleanTitle.split(bySuffix);
        cleanTitle = titleParts[0];
        if (titleParts.length > 1) {
          extractedUsername = titleParts[1].split(onWeWriteSuffix)[0];
        }
      } else if (cleanTitle.includes(onWeWriteSuffix)) {
        cleanTitle = cleanTitle.substring(0, cleanTitle.indexOf(onWeWriteSuffix));
      }

      if (cleanTitle && cleanTitle !== 'Untitled') {
        // Cache this title for future use
        pageTitleCache.set(pageId, cleanTitle);

        // Return with group name if available
        if (extractedGroupName) {
          return `Page: ${cleanTitle} in ${extractedGroupName}`;
        }
        // Return with username if available
        else if (extractedUsername) {
          return `Page: ${cleanTitle} by ${extractedUsername}`;
        }
        return `Page: ${cleanTitle}`;
      }
    }

    // If we're in a browser environment, try to fetch the title asynchronously
    if (typeof window !== 'undefined') {
      // Trigger an async fetch but return a better fallback title
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
          return `Page: ${category} Content`;
        }
      }

      // Look for any heading element as a last resort
      const anyHeading = document.querySelector('h1, h2, h3')?.textContent;
      if (anyHeading && anyHeading !== 'Untitled') {
        // First try to find group name in the page
        const groupElement = document.querySelector('[data-group-name]');
        if (groupElement) {
          const groupName = groupElement.getAttribute('data-group-name') || groupElement.textContent;

          // Skip "Unknown" group names
          if (groupName && groupName !== 'Unknown') {
            return `Page: ${anyHeading} in ${groupName}`;
          }
        }

        // If no group, try to find username in the page
        const authorElement = document.querySelector('[data-author-username]');
        if (authorElement) {
          const username = authorElement.getAttribute('data-author-username') ||
                          authorElement.textContent;
          if (username) {
            return `Page: ${anyHeading} by ${username}`;
          }
        }
        return `Page: ${anyHeading}`;
      }

      // If all else fails, use a generic title but trigger our delayed tracking
      // to ensure we eventually get the correct title

      // Start the delayed tracking process
      trackPageViewWhenReady(pageId, `Page: ${pageId}`);

      // Return a temporary title that indicates content is loading
      // This will be filtered out from analytics tracking
      return `__LOADING_PLACEHOLDER__`;
    }

    // Fallback to indicate content is still loading
    return `__LOADING_PLACEHOLDER__`;
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
    // Skip if we already have this in cache, but still try to update with username
    if (pageTitleCache.has(pageId)) {
      const cachedTitle = pageTitleCache.get(pageId);

      // Even if we have the title cached, we might need to update analytics with the group name or username
      try {
        const response = await pageApi.getPage(pageId);
        const metadata = response.success ? response.data : null;
        if (metadata) {
          // Check if this is a group page
          if (metadata.groupId && metadata.groupName) {
            // For group pages, use the group name
            const pageTitle = `Page: ${cachedTitle} in ${metadata.groupName}`;

            if (typeof window !== 'undefined' && window.gtag) {
              window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '', {
                page_path: window.location.pathname,
                page_title: pageTitle,
                page_location: window.location.href
              });
            }
          } else {
            // For regular pages, try to get the username
            let username: string | null = null;

            // Try to get username from metadata
            if (metadata.username &&
                metadata.username !== 'Anonymous' &&
                metadata.username !== 'Missing username') {
              username = metadata.username;
            }
            // If no username in metadata but we have userId, try to get username from userId
            else if (metadata.userId) {
              try {
                const { getUsernameById } = await import('../utils/userUtils');
                const fetchedUsername = await getUsernameById(metadata.userId);

                if (fetchedUsername &&
                    fetchedUsername !== 'Anonymous' &&
                    fetchedUsername !== 'Missing username') {
                  username = fetchedUsername;
                }
              } catch (error) {
                // Failed to fetch username by ID - non-fatal
              }
            }

            // If we found a valid username, update analytics
            if (username) {
              const pageTitle = `Page: ${cachedTitle} by ${username}`;

              if (typeof window !== 'undefined' && window.gtag) {
                window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '', {
                  page_path: window.location.pathname,
                  page_title: pageTitle,
                  page_location: window.location.href
                });
              }
            }
          }
        }
      } catch (error) {
        // Failed to update analytics with username - non-fatal
      }

      return;
    }

    // Try to get the page metadata directly
    try {
      const response = await pageApi.getPage(pageId);
      const metadata = response.success ? response.data : null;
      if (metadata && metadata.title && metadata.title !== 'Untitled') {
        // We have a valid title from metadata
        pageTitleCache.set(pageId, metadata.title);

        // Update analytics with the actual page title including group name or username if available
        if (typeof window !== 'undefined' && window.gtag) {
          const pathname = window.location.pathname;
          let pageTitle = `Page: ${metadata.title}`;

          // Check if this is a group page
          if (metadata.groupId && metadata.groupName) {
            // For group pages, use the group name
            pageTitle = `Page: ${metadata.title} in ${metadata.groupName}`;
          } else {
            // For regular pages, try to get the username
            let username: string | null = null;

            // Try to get username from metadata
            if (metadata.username &&
                metadata.username !== 'Anonymous' &&
                metadata.username !== 'Missing username') {
              username = metadata.username;
            }
            // If no username in metadata but we have userId, try to get username from userId
            else if (metadata.userId) {
              try {
                const { getUsernameById } = await import('../utils/userUtils');
                const fetchedUsername = await getUsernameById(metadata.userId);

                if (fetchedUsername &&
                    fetchedUsername !== 'Anonymous' &&
                    fetchedUsername !== 'Missing username') {
                  username = fetchedUsername;
                }
              } catch (error) {
                // Failed to fetch username by ID - non-fatal
              }
            }

            // If we found a valid username, include it in the page title
            if (username) {
              pageTitle = `Page: ${metadata.title} by ${username}`;
            }
          }

          window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '', {
            page_path: pathname,
            page_title: pageTitle,
            page_location: window.location.href
          });
        }
        return;
      }
    } catch (metadataError) {
      // Failed to fetch page metadata - non-fatal
    }

    // If direct metadata fetch failed, try the API approach
    const fallbackResponse = await pageApi.getPage(pageId);
    const title = fallbackResponse.success ? fallbackResponse.data?.title : null;

    // Cache the title for future use
    if (title && title !== 'Untitled') {
      pageTitleCache.set(pageId, title);

      // If we have Google Analytics available, send an updated page view
      // This helps correct the page title in GA after we've fetched it
      if (typeof window !== 'undefined' && window.gtag) {
        const pathname = window.location.pathname;

        // Try to get the username from the DOM or document title
        let username: string | null = null;

        // Try to extract username from document title
        if (document.title && document.title.includes(' by ')) {
          const parts = document.title.split(' by ');
          if (parts.length >= 2) {
            const authorPart = parts[1];
            const extractedUsername = authorPart.split(' on WeWrite')[0];
            if (extractedUsername !== 'Anonymous') {
              username = extractedUsername;
            }
          }
        }

        // If not found in document title, try to find in DOM
        if (!username) {
          const authorElement = document.querySelector('[data-author-username]');
          if (authorElement) {
            const extractedUsername = authorElement.getAttribute('data-author-username') ||
                      authorElement.textContent;
            if (extractedUsername && extractedUsername !== 'Anonymous') {
              username = extractedUsername;
            }
          }
        }

        // Check if this is a group page
        const groupElement = document.querySelector('[data-group-name]');
        const groupName = groupElement ? groupElement.getAttribute('data-group-name') || groupElement.textContent : null;

        // Format the page title with group name or username if available
        let pageTitle = `Page: ${title}`;
        if (groupName && groupName !== 'Unknown') {
          pageTitle = `Page: ${title} in ${groupName}`;
        } else if (username) {
          pageTitle = `Page: ${title} by ${username}`;
        }

        window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '', {
          page_path: pathname,
          page_title: pageTitle,
          page_location: window.location.href
        });
      }
    } else {
      // Even if we couldn't get a good title, update GA with a better generic title
      // to avoid showing page IDs in analytics
      if (typeof window !== 'undefined' && window.gtag) {
        const pathname = window.location.pathname;

        // Try to get a better fallback from the URL path
        let pageTitle = `Page: Content`;
        const pathSegments = pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          const lastSegment = pathSegments[pathSegments.length - 1];
          if (lastSegment === pageId && pathSegments.length > 1) {
            // Use the previous path segment as a category
            const category = pathSegments[pathSegments.length - 2]
              .charAt(0).toUpperCase() +
              pathSegments[pathSegments.length - 2].slice(1);
            pageTitle = `Page: ${category} Content`;
          }
        }

        // Try to get the title and username from the DOM as a last resort
        const h1Element = document.querySelector('h1');
        if (h1Element && h1Element.textContent && h1Element.textContent !== 'Untitled') {
          // Try to get the username from the DOM or document title
          let username: string | null = null;

          // Try to extract username from document title
          if (document.title && document.title.includes(' by ')) {
            const parts = document.title.split(' by ');
            if (parts.length >= 2) {
              const authorPart = parts[1];
              const extractedUsername = authorPart.split(' on WeWrite')[0];
              if (extractedUsername !== 'Anonymous') {
                username = extractedUsername;
              }
            }
          }

          // If not found in document title, try to find in DOM
          if (!username) {
            const authorElement = document.querySelector('[data-author-username]');
            if (authorElement) {
              const extractedUsername = authorElement.getAttribute('data-author-username') ||
                        authorElement.textContent;
              if (extractedUsername && extractedUsername !== 'Anonymous') {
                username = extractedUsername;
              }
            }
          }

          // Check if this is a group page
          const groupElement = document.querySelector('[data-group-name]');
          const groupName = groupElement ? groupElement.getAttribute('data-group-name') || groupElement.textContent : null;

          // Format the page title with group name or username if available
          if (groupName && groupName !== 'Unknown') {
            pageTitle = `Page: ${h1Element.textContent} in ${groupName}`;
          } else if (username) {
            pageTitle = `Page: ${h1Element.textContent} by ${username}`;
          } else {
            pageTitle = `Page: ${h1Element.textContent}`;
          }
        }

        window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '', {
          page_path: pathname,
          page_title: pageTitle,
          page_location: window.location.href
        });
      }
    }
  } catch (error) {
    // Failed to fetch page title for analytics - non-fatal
  }
}

/**
 * Check if the content is ready for analytics tracking
 * This verifies that we have a valid title and username (if applicable)
 *
 * @param pageId - The page ID to check
 * @param currentTitle - The current title we have
 * @returns Object with isReady flag and improved title if available
 */
export function isContentReadyForAnalytics(pageId: string, currentTitle?: string): {
  isReady: boolean;
  title: string;
  hasUsername: boolean;
} {
  // If we're not in a browser environment, content is never ready
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { isReady: false, title: currentTitle || `Page: ${pageId}`, hasUsername: false };
  }

  // Default response
  const result = {
    isReady: false,
    title: currentTitle || `Page: ${pageId}`,
    hasUsername: false
  };

  // Check if we have a loading placeholder title
  const isLoadingTitle = !currentTitle ||
    currentTitle === `Page: ${pageId}` ||
    currentTitle === '__LOADING_PLACEHOLDER__';

  // If we already have a good title (not a loading placeholder), we're ready
  if (!isLoadingTitle) {
    // Check if we have username or group information
    const hasUsername = currentTitle?.includes(' by ') || false;
    const hasGroup = currentTitle?.includes(' in ') || false;

    // If the title includes username or group name, we're fully ready
    if (hasUsername || hasGroup) {
      result.hasUsername = hasUsername;
      result.isReady = true;
      return result;
    }
  }

  // Try to get the page title from the DOM
  const contentTitle = document.querySelector('h1')?.textContent;
  let username: string | null = null;

  // Try to extract username from document title
  if (document.title && document.title.includes(' by ')) {
    const parts = document.title.split(' by ');
    if (parts.length >= 2) {
      const authorPart = parts[1];
      const extractedUsername = authorPart.split(' on WeWrite')[0];

      // Skip "Anonymous" usernames
      if (extractedUsername !== 'Anonymous') {
        username = extractedUsername;
      }
    }
  }

  // If not found in document title, try to find in DOM
  if (!username) {
    const authorElement = document.querySelector('[data-author-username]');
    if (authorElement) {
      const extractedUsername = authorElement.getAttribute('data-author-username') ||
                authorElement.textContent;

      // Skip "Anonymous" usernames
      if (extractedUsername && extractedUsername !== 'Anonymous' && extractedUsername !== 'Missing username') {
        username = extractedUsername;
      }
    }
  }

  // Check if this is a group page
  const groupElement = document.querySelector('[data-group-name]');
  const groupName = groupElement ? groupElement.getAttribute('data-group-name') || groupElement.textContent : null;
  const hasGroup = groupName && groupName !== 'Unknown';

  // If we have both title and group name, we're fully ready
  if (contentTitle && contentTitle !== 'Untitled' && hasGroup) {
    result.isReady = true;
    result.title = `Page: ${contentTitle} in ${groupName}`;
    return result;
  }

  // If we have both title and username, we're fully ready
  if (contentTitle && contentTitle !== 'Untitled' && username) {
    result.isReady = true;
    result.title = `Page: ${contentTitle} by ${username}`;
    result.hasUsername = true;
    return result;
  }

  // If we have just the title, we're partially ready
  if (contentTitle && contentTitle !== 'Untitled') {
    // We have a title but no username or group name - this is better than nothing
    result.title = `Page: ${contentTitle}`;
    result.isReady = true;
    return result;
  }

  // Content is not ready
  return result;
}

/**
 * Track a page view with Google Analytics, but only if the content is ready
 * If content is not ready, it will delay tracking until content is available
 *
 * @param pageId - The page ID
 * @param currentTitle - The current title we have
 * @param maxRetries - Maximum number of retries before giving up
 * @returns Promise that resolves when tracking is complete or max retries reached
 */
export function trackPageViewWhenReady(
  pageId: string,
  currentTitle?: string,
  maxRetries: number = 10
): void {
  // Clear any existing pending updates for this page
  if (pendingAnalyticsUpdates.has(pageId)) {
    clearTimeout(pendingAnalyticsUpdates.get(pageId));
    pendingAnalyticsUpdates.delete(pageId);
  }

  // Check if content is ready
  const { isReady, title, hasUsername } = isContentReadyForAnalytics(pageId, currentTitle);

  // If content is ready, mark as tracked but don't send analytics here
  // Analytics tracking is now handled by UnifiedAnalyticsProvider
  if (isReady) {
    const cacheKey = `${pageId}_${title}`;
    if (!trackedPages.has(cacheKey)) {
      // Mark this page as tracked to prevent duplicate processing
      trackedPages.add(cacheKey);
    }

    // If we don't have username yet, continue trying to get it
    if (!hasUsername && maxRetries > 0) {
      const timeout = setTimeout(() => {
        trackPageViewWhenReady(pageId, title, maxRetries - 1);
      }, 500);

      pendingAnalyticsUpdates.set(pageId, timeout);
    }

    return;
  }

  // Content is not ready, retry after a delay if we have retries left
  if (maxRetries > 0) {
    const timeout = setTimeout(() => {
      trackPageViewWhenReady(pageId, currentTitle, maxRetries - 1);
    }, 500);

    pendingAnalyticsUpdates.set(pageId, timeout);
  } else {
    // Track with the best title we have as a last resort
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '', {
        page_path: window.location.pathname,
        page_title: title,
        page_location: window.location.href
      });
    }
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
      const cachedTitle = pageTitleCache.get(pageId);

      // Try to get the full metadata to include group name or username
      const response = await pageApi.getPage(pageId);
      const metadata = response.success ? response.data : null;

      // Check if this is a group page
      if (metadata?.groupId && metadata?.groupName) {
        // For group pages, use the group name
        return `Page: ${cachedTitle} in ${metadata.groupName}`;
      } else {
        // For regular pages, try to get the username
        let username: string | null = null;

        // Try to get username from metadata
        if (metadata?.username &&
            metadata.username !== 'Anonymous' &&
            metadata.username !== 'Missing username') {
          username = metadata.username;
        }
        // If no username in metadata but we have userId, try to get username from userId
        else if (metadata?.userId) {
          try {
            const { getUsernameById } = await import('../utils/userUtils');
            const fetchedUsername = await getUsernameById(metadata.userId);

            if (fetchedUsername &&
                fetchedUsername !== 'Anonymous' &&
                fetchedUsername !== 'Missing username') {
              username = fetchedUsername;
            }
          } catch (error) {
            // Failed to fetch username by ID - non-fatal
          }
        }

        // If we found a valid username, include it in the page title
        if (username) {
          return `Page: ${cachedTitle} by ${username}`;
        }

        return `Page: ${cachedTitle}`;
      }
    }

    // Fetch from API
    const response = await pageApi.getPage(pageId);
    const metadata = response.success ? response.data : null;
    if (metadata?.title) {
      // Cache for future use
      pageTitleCache.set(pageId, metadata.title);

      // Check if this is a group page
      if (metadata.groupId && metadata.groupName) {
        // For group pages, use the group name
        return `Page: ${metadata.title} in ${metadata.groupName}`;
      } else {
        // For regular pages, try to get the username
        let username: string | null = null;

        // Try to get username from metadata
        if (metadata.username &&
            metadata.username !== 'Anonymous' &&
            metadata.username !== 'Missing username') {
          username = metadata.username;
        }
        // If no username in metadata but we have userId, try to get username from userId
        else if (metadata.userId) {
          try {
            const { getUsernameById } = await import('../utils/userUtils');
            const fetchedUsername = await getUsernameById(metadata.userId);

            if (fetchedUsername &&
                fetchedUsername !== 'Anonymous' &&
                fetchedUsername !== 'Missing username') {
              username = fetchedUsername;
            }
          } catch (error) {
            // Failed to fetch username by ID - non-fatal
          }
        }

        // If we found a valid username, include it in the page title
        if (username) {
          return `Page: ${metadata.title} by ${username}`;
        }

        return `Page: ${metadata.title}`;
      }
    }
  } catch (error) {
    // Failed to fetch page title for analytics - non-fatal
  }

  // Return a better generic title instead of showing the ID
  return `Page: Loading Content`;
}