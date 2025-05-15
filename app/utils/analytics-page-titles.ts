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

  // Content pages (using UUID pattern or /pages/ path)
  const pageId = extractPageIdFromPath(pathname);
  if (pageId) {
    // Check if we're in edit mode
    if (searchParams?.has('edit')) {
      return 'Page Editor';
    }

    // Try to get the page title and author from the DOM first (most accurate)
    const contentTitle = document.querySelector('h1')?.textContent;
    let username = null;

    // Try to extract username from document title
    if (documentTitle && documentTitle.includes(' by ')) {
      const parts = documentTitle.split(' by ');
      if (parts.length >= 2) {
        const authorPart = parts[1];
        username = authorPart.split(' on WeWrite')[0];

        // Skip "Anonymous" usernames - we'll try to get a better one later
        if (username === 'Anonymous') {
          username = null;
        }
      }
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

      // Try to find username in the page
      const authorElement = document.querySelector('[data-author-username]');
      if (authorElement) {
        username = authorElement.getAttribute('data-author-username') ||
                  authorElement.textContent;

        // Skip "Anonymous" usernames
        if (username && username !== 'Anonymous' && username !== 'Missing username') {
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
                    console.log('Updated analytics with fetched username:', fetchedUsername);
                  }
                }
              } catch (error) {
                console.error('Error fetching username for analytics:', error);
              }
            }, 500);
          }
        }
      } catch (error) {
        console.error('Error trying to get username from page data:', error);
      }

      return `Page: ${contentTitle}`;
    }

    // Check if we have this page title in our cache
    if (pageTitleCache.has(pageId)) {
      const cachedTitle = pageTitleCache.get(pageId);

      // Try to find username in the page
      const authorElement = document.querySelector('[data-author-username]');
      if (authorElement) {
        username = authorElement.getAttribute('data-author-username') ||
                  authorElement.textContent;
        if (username) {
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
      let extractedUsername = null;

      // Remove "WeWrite - " prefix if present
      if (cleanTitle.startsWith('WeWrite - ')) {
        cleanTitle = cleanTitle.substring('WeWrite - '.length);
      }

      // Extract username if present in " by username on WeWrite" format
      const bySuffix = " by ";
      const onWeWriteSuffix = " on WeWrite";
      const taglineSuffix = " - The social wiki where every page is a fundraiser";

      // First, remove the tagline if present
      if (cleanTitle.includes(taglineSuffix)) {
        cleanTitle = cleanTitle.replace(taglineSuffix, '');
      }

      // Then extract username if present
      if (cleanTitle.includes(bySuffix)) {
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

        // Return with username if available
        if (extractedUsername) {
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
        // Try to find username in the page
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

      // If all else fails, use a generic title but trigger async fetch with a longer timeout
      // to ensure we eventually get the correct title
      setTimeout(async () => {
        try {
          const { getPageMetadata } = await import('../firebase/database');
          const metadata = await getPageMetadata(pageId);

          if (metadata?.title) {
            let updatedTitle = `Page: ${metadata.title}`;

            // Include username if available
            if (metadata.username &&
                metadata.username !== 'Anonymous' &&
                metadata.username !== 'Missing username') {
              updatedTitle = `Page: ${metadata.title} by ${metadata.username}`;
            } else if (metadata.userId) {
              // Try to get username from userId
              try {
                const { getUsernameById } = await import('../utils/userUtils');
                const username = await getUsernameById(metadata.userId);

                if (username && username !== 'Anonymous' && username !== 'Missing username') {
                  updatedTitle = `Page: ${metadata.title} by ${username}`;
                }
              } catch (error) {
                console.error('Error fetching username for analytics:', error);
              }
            }

            // Update analytics with the correct title
            if (typeof window !== 'undefined' && window.gtag) {
              window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '', {
                page_path: window.location.pathname,
                page_title: updatedTitle,
                page_location: window.location.href
              });
              console.log('Updated analytics with fetched title:', updatedTitle);
            }
          }
        } catch (error) {
          console.error('Error fetching page metadata for analytics:', error);
        }
      }, 1000);

      // Return a temporary title
      return `Page: Loading Content`;
    }

    // Fallback to a better generic title instead of showing the ID
    return `Page: Loading Content`;
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
      console.log(`Using cached title for ${pageId}: ${cachedTitle}`);

      // Even if we have the title cached, we might need to update analytics with the username
      try {
        const metadata = await getPageMetadata(pageId);
        if (metadata) {
          let username = null;

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
              console.error('Error fetching username by ID:', error);
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
              console.log('Updated analytics with cached title and fetched username:', pageTitle);
            }
          }
        }
      } catch (error) {
        console.error('Error updating analytics with username:', error);
      }

      return;
    }

    // Try to get the page metadata directly
    try {
      const metadata = await getPageMetadata(pageId);
      if (metadata && metadata.title && metadata.title !== 'Untitled') {
        // We have a valid title from metadata
        pageTitleCache.set(pageId, metadata.title);

        // Update analytics with the actual page title including username if available
        if (typeof window !== 'undefined' && window.gtag) {
          const pathname = window.location.pathname;
          let pageTitle = `Page: ${metadata.title}`;
          let username = null;

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
              console.error('Error fetching username by ID:', error);
            }
          }

          // If we found a valid username, include it in the page title
          if (username) {
            pageTitle = `Page: ${metadata.title} by ${username}`;
          }

          window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '', {
            page_path: pathname,
            page_title: pageTitle,
            page_location: window.location.href
          });

          console.log('Updated analytics with actual page title:', pageTitle);
        }
        return;
      }
    } catch (metadataError) {
      console.error('Error fetching page metadata:', metadataError);
    }

    // If direct metadata fetch failed, try the cached title approach
    const title = await getCachedPageTitle(pageId);

    // Cache the title for future use
    if (title && title !== 'Untitled') {
      pageTitleCache.set(pageId, title);

      // If we have Google Analytics available, send an updated page view
      // This helps correct the page title in GA after we've fetched it
      if (typeof window !== 'undefined' && window.gtag) {
        const pathname = window.location.pathname;

        // Try to get the username from the DOM or document title
        let username = null;

        // Try to extract username from document title
        if (document.title && document.title.includes(' by ')) {
          const parts = document.title.split(' by ');
          if (parts.length >= 2) {
            const authorPart = parts[1];
            username = authorPart.split(' on WeWrite')[0];
          }
        }

        // If not found in document title, try to find in DOM
        if (!username) {
          const authorElement = document.querySelector('[data-author-username]');
          if (authorElement) {
            username = authorElement.getAttribute('data-author-username') ||
                      authorElement.textContent;
          }
        }

        // Format the page title with username if available
        let pageTitle = `Page: ${title}`;
        if (username) {
          pageTitle = `Page: ${title} by ${username}`;
        }

        window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '', {
          page_path: pathname,
          page_title: pageTitle,
          page_location: window.location.href
        });

        console.log('Updated analytics with fetched page title:', pageTitle);
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
          let username = null;

          // Try to extract username from document title
          if (document.title && document.title.includes(' by ')) {
            const parts = document.title.split(' by ');
            if (parts.length >= 2) {
              const authorPart = parts[1];
              username = authorPart.split(' on WeWrite')[0];
            }
          }

          // If not found in document title, try to find in DOM
          if (!username) {
            const authorElement = document.querySelector('[data-author-username]');
            if (authorElement) {
              username = authorElement.getAttribute('data-author-username') ||
                        authorElement.textContent;
            }
          }

          // Format the page title with username if available
          if (username) {
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

        console.log('Updated analytics with improved generic page title:', pageTitle);
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
      const cachedTitle = pageTitleCache.get(pageId);

      // Try to get the full metadata to include username
      const metadata = await getPageMetadata(pageId);
      let username = null;

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
          console.error('Error fetching username by ID:', error);
        }
      }

      // If we found a valid username, include it in the page title
      if (username) {
        return `Page: ${cachedTitle} by ${username}`;
      }

      return `Page: ${cachedTitle}`;
    }

    // Fetch from database
    const metadata = await getPageMetadata(pageId);
    if (metadata?.title) {
      // Cache for future use
      pageTitleCache.set(pageId, metadata.title);

      let username = null;

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
          console.error('Error fetching username by ID:', error);
        }
      }

      // If we found a valid username, include it in the page title
      if (username) {
        return `Page: ${metadata.title} by ${username}`;
      }

      return `Page: ${metadata.title}`;
    }
  } catch (error) {
    console.error('Error fetching page title for analytics:', error);
  }

  // Return a better generic title instead of showing the ID
  return `Page: Loading Content`;
}
