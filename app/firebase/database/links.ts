import type { LinkData, EditorContent } from "../../types/database";

/**
 * Extract links from editor content nodes
 */
export const extractLinksFromNodes = (nodes: EditorContent): LinkData[] => {
  const links: LinkData[] = [];

  const extractFromNode = (node: any) => {

    // Check if this node is a link
    if (node.type === 'link' || node.url || node.href) {

      // Extract text from children if available
      let linkText = node.text || node.displayText || '';
      if (!linkText && node.children && Array.isArray(node.children)) {
        linkText = node.children.map(child => child.text || '').join('');
      }

      const linkData: LinkData = {
        url: node.url || node.href || '',
        text: linkText,
        type: 'external'
      };

      // Store additional properties for compound links
      if (node.showAuthor) {
        linkData.showAuthor = node.showAuthor;
      }
      if (node.authorUsername) {
        linkData.authorUsername = node.authorUsername;
      }
      if (node.pageTitle) {
        linkData.pageTitle = node.pageTitle;
      }
      if (node.originalPageTitle) {
        linkData.originalPageTitle = node.originalPageTitle;
      }

      // Check for direct pageId property first (most reliable)
      if (node.pageId) {
        linkData.type = 'page';
        linkData.pageId = node.pageId;
      }
      // Check for isPageLink flag (WeWrite specific)
      else if (node.isPageLink) {
        linkData.type = 'page';
        // Try to extract pageId from URL if not directly available
        if (linkData.url.startsWith('/pages/')) {
          linkData.pageId = linkData.url.replace('/pages/', '').split(/[\/\?#]/)[0];
        } else if (linkData.url.startsWith('/') && linkData.url.length > 1) {
          const directPageId = linkData.url.substring(1).split(/[\/\?#]/)[0];
          if (!directPageId.includes('/')) {
            linkData.pageId = directPageId;
          }
        }
      }
      // Check for direct userId property
      else if (node.userId) {
        linkData.type = 'user';
        linkData.userId = node.userId;
      }
      // Check for isUser flag (WeWrite specific)
      else if (node.isUser) {
        linkData.type = 'user';
        // Try to extract userId from URL if not directly available
        const userIdMatch = linkData.url.match(/\/users?\/([^\/\?#]+)/);
        if (userIdMatch) {
          linkData.userId = userIdMatch[1];
        }
      }
      // Check for isExternal flag
      else if (node.isExternal) {
        linkData.type = 'external';
      }
      // Fallback: Check URL patterns for internal WeWrite links
      else if (linkData.url.startsWith('/') || linkData.url.includes('/pages/')) {
        linkData.type = 'page';
        // Extract page ID from URL
        const pageIdMatch = linkData.url.match(/\/pages\/([^\/\?#]+)/);
        if (pageIdMatch) {
          linkData.pageId = pageIdMatch[1];
        } else if (linkData.url.startsWith('/') && linkData.url.length > 1) {
          // Handle direct page ID links like "/pageId"
          const directPageId = linkData.url.substring(1);
          // Only treat as page ID if it doesn't contain additional slashes (not a path)
          if (!directPageId.includes('/')) {
            linkData.pageId = directPageId;
          }
        }
      }
      // Check if it's a user link
      else if (linkData.url.includes('/user/') || linkData.url.includes('/users/')) {
        linkData.type = 'user';
        const userIdMatch = linkData.url.match(/\/users?\/([^\/\?#]+)/);
        if (userIdMatch) {
          linkData.userId = userIdMatch[1];
        }
      }
      // Check for WeWrite domain links (should be treated as internal)
      else if (linkData.url.includes('wewrite.app') || linkData.url.includes('localhost:3000')) {
        // This is an internal WeWrite link with full domain
        if (linkData.url.includes('/user/') || linkData.url.includes('/users/')) {
          linkData.type = 'user';
          const userIdMatch = linkData.url.match(/\/users?\/([^\/\?#]+)/);
          if (userIdMatch) {
            linkData.userId = userIdMatch[1];
          }
        } else {
          // Assume it's a page link
          linkData.type = 'page';
          // Try to extract page ID from various URL patterns
          const pageIdMatch = linkData.url.match(/\/pages\/([^\/\?#]+)/) ||
                             linkData.url.match(/wewrite\.app\/([^\/\?#]+)/) ||
                             linkData.url.match(/localhost:3000\/([^\/\?#]+)/);
          if (pageIdMatch) {
            linkData.pageId = pageIdMatch[1];
          }
        }
      }
      // Only keep as external if it's truly external (has protocol and not WeWrite domain)
      else if (!linkData.url.startsWith('http://') && !linkData.url.startsWith('https://')) {
        // No protocol, likely internal - treat as page link
        linkData.type = 'page';
        if (linkData.url.length > 0) {
          linkData.pageId = linkData.url;
        }
      }

      links.push(linkData);
    }

    // Check if this node has children and recursively extract links
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(extractFromNode);
    }

    // Handle text nodes that might contain link information
    if (node.text && typeof node.text === 'string') {
      // Extract any URLs from plain text
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matches = node.text.match(urlRegex);
      if (matches) {
        matches.forEach(url => {
          links.push({
            url,
            text: url,
            type: 'external'
          });
        });
      }
    }
  };

  if (Array.isArray(nodes)) {
    nodes.forEach(extractFromNode);
  }

  // Remove duplicates based on URL for external links and pageId for page links
  const uniqueLinks = links.filter((link, index, self) =>
    index === self.findIndex(l => {
      // For page links, deduplicate by pageId
      if (link.pageId && l.pageId) {
        return l.pageId === link.pageId;
      }
      // For external links, deduplicate by URL
      return l.url === link.url;
    })
  );

  return uniqueLinks;
};

/**
 * Find backlinks to a specific page (DEPRECATED - use getBacklinks from backlinks.ts)
 * This function is kept for backward compatibility but will be removed in the future.
 */
export const findBacklinks = async (pageId: string, limitCount: number = 10): Promise<Array<{
  id: string;
  title: string;
  username?: string;
  lastModified: any;
  isPublic: boolean;
}>> => {
  // Use the new efficient what-links-here system
  try {
    const { getWhatLinksHere } = await import('./whatLinksHere');
    return await getWhatLinksHere(pageId, limitCount);
  } catch (error) {
    // Fall back to the old inefficient method if the new one fails
  }
  try {
    const { db } = await import('../config');
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    const { getCollectionName } = await import('../../utils/environmentConfig');

    // Query for pages that might contain links to our target page
    // Note: We filter out deleted pages in the loop instead of using where('deleted', '!=', true)
    // because that requires all documents to have the 'deleted' field
    const pagesQuery = query(
      collection(db, getCollectionName('pages')),
      where('isPublic', '==', true),
      orderBy('lastModified', 'desc'),
      limit(100) // Get more pages to search through
    );

    const snapshot = await getDocs(pagesQuery);

    const backlinks: Array<{
      id: string;
      title: string;
      username?: string;
      lastModified: any;
      isPublic: boolean;
    }> = [];

    // Search through page content for links to our target page
    let pagesProcessed = 0;
    let pagesWithContent = 0;
    let pagesWithLinks = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      pagesProcessed++;

      // Skip the target page itself
      if (doc.id === pageId) {
        continue;
      }

      // Skip deleted pages (filter here instead of in query)
      if (data.deleted === true) {
        continue;
      }

      // Skip if no content
      if (!data.content) {
        continue;
      }

      pagesWithContent++;

      try {
        // Parse content if it's a string
        let contentNodes: EditorContent = [];
        if (typeof data.content === 'string') {
          try {
            contentNodes = JSON.parse(data.content);
          } catch (parseError) {
            continue;
          }
        } else if (Array.isArray(data.content)) {
          contentNodes = data.content;
        } else {
          continue; // Skip if content format is unexpected
        }

        // Extract links from the page content
        const links = extractLinksFromNodes(contentNodes);

        if (links.length > 0) {
          pagesWithLinks++;
        }

        // Check if any link points to our target page
        const hasLinkToTarget = links.some(link => {
          // Check for page links that match our target
          if (link.type === 'page' && link.pageId === pageId) {
            return true;
          }

          // Check for URL-based links that match our target
          if (link.url) {
            // Handle /pages/pageId format
            if (link.url.startsWith('/pages/')) {
              const urlPageId = link.url.replace('/pages/', '').split(/[\/\?#]/)[0];
              if (urlPageId === pageId) {
                return true;
              }
            }

            // Handle /pageId format (direct page links)
            if (link.url.startsWith('/') && link.url.length > 1) {
              const urlPageId = link.url.substring(1).split(/[\/\?#]/)[0];
              // Only match if it's a simple page ID (no additional path segments)
              if (!urlPageId.includes('/') && urlPageId === pageId) {
                return true;
              }
            }
          }

          return false;
        });

        if (hasLinkToTarget) {
          backlinks.push({
            id: doc.id,
            title: data.title || 'Untitled',
            username: data.username,
            lastModified: data.lastModified,
            isPublic: data.isPublic
          });

          // Stop when we have enough results
          if (backlinks.length >= limitCount) {
            break;
          }
        }
      } catch (error) {
        continue;
      }
    }

    return backlinks;
  } catch (error) {
    return [];
  }
};

/**
 * Validate if a link URL is accessible
 */
export const validateLinkUrl = async (url: string): Promise<boolean> => {
  try {
    // For internal links, check if the page exists
    if (url.startsWith('/') || url.includes('/pages/')) {
      const { getPageById } = await import('./pages');
      let pageId = '';
      
      if (url.startsWith('/pages/')) {
        const match = url.match(/\/pages\/([^\/\?#]+)/);
        pageId = match ? match[1] : '';
      } else if (url.startsWith('/')) {
        pageId = url.substring(1);
      }
      
      if (pageId) {
        const result = await getPageById(pageId);
        return !!result.pageData;
      }
    }

    // For external links, we could ping them but that's expensive
    // For now, assume they're valid if they look like URLs
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
  } catch (error) {
    return false;
  }
};

/**
 * Extract page references from content
 */
export const extractPageReferences = (content: string | EditorContent): string[] => {
  const pageIds: string[] = [];

  try {
    let nodes: EditorContent = [];

    if (typeof content === 'string') {
      nodes = JSON.parse(content);
    } else if (Array.isArray(content)) {
      nodes = content;
    }

    const links = extractLinksFromNodes(nodes);

    links.forEach(link => {
      // Accept both 'page' and 'link' types, and ensure it's not external
      if (link.pageId && !link.isExternal) {
        pageIds.push(link.pageId);
      }
    });
  } catch (error) {
    // Silent error handling
  }

  // Remove duplicates
  return [...new Set(pageIds)];
};

/**
 * Extract domain from a URL
 */
export const extractDomainFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
};

/**
 * Related page result with match type information
 */
export interface RelatedPageResult {
  id: string;
  title: string;
  username?: string;
  lastModified: any;
  matchType: 'exact' | 'partial';
  matchedUrl?: string; // The URL that was matched (for partial matches)
}

/**
 * Find pages that link to a specific external URL
 * Returns both exact matches and partial matches (same domain, different path)
 *
 * OPTIMIZED: Uses the external links index for O(1) lookups instead of scanning all pages.
 * Falls back to the legacy scan method if the index is empty (not yet backfilled).
 */
export const findPagesLinkingToExternalUrl = async (
  externalUrl: string,
  limitCount: number = 10
): Promise<RelatedPageResult[]> => {
  try {
    // Try the indexed version first (fast O(1) lookup)
    // Only runs on server-side since externalLinksIndexService uses firebase-admin
    if (typeof window === 'undefined') {
      try {
        const { findPagesLinkingToExternalUrlIndexed } = await import('../../services/externalLinksIndexService');
        const indexedResults = await findPagesLinkingToExternalUrlIndexed(externalUrl, limitCount);

        // If we got results from the index, use them
        if (indexedResults.length > 0) {
          return indexedResults;
        }
        // If no results, fall through to legacy method
        // (could be a new deployment before backfill, or genuinely no matches)
      } catch (indexError) {
        // Index query failed, fall back to legacy method
        console.warn('[findPagesLinkingToExternalUrl] Index query failed, using legacy scan:', indexError);
      }
    }

    // Legacy fallback: Scan pages (O(n) - expensive but reliable)
    const { db } = await import('../config');
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');

    const targetDomain = extractDomainFromUrl(externalUrl);

    // Query for pages that might contain the external URL
    // Note: This is a simplified approach. For better performance, you might want to
    // index external links separately or use full-text search
    // Increased limit to 500 to search more pages for domain matches
    const pagesQuery = query(
      collection(db, getCollectionName('pages')),
      where('isPublic', '==', true),
      where('deleted', '!=', true),
      orderBy('lastModified', 'desc'),
      limit(500) // Search through more pages to find domain matches
    );

    const snapshot = await getDocs(pagesQuery);
    const exactMatches: RelatedPageResult[] = [];
    const partialMatches: RelatedPageResult[] = [];

    // Search through page content for the external URL
    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Skip if no content
      if (!data.content) continue;

      try {
        // Extract links from the page content
        const links = extractLinksFromNodes(data.content);

        // Check for exact match first
        const hasExactMatch = links.some(link =>
          link.type === 'external' && link.url === externalUrl
        );

        if (hasExactMatch) {
          exactMatches.push({
            id: doc.id,
            title: data.title || 'Untitled',
            username: data.username,
            lastModified: data.lastModified,
            matchType: 'exact'
          });
        } else if (targetDomain) {
          // Check for partial match (same domain, different URL)
          const partialMatchLink = links.find(link => {
            if (link.type !== 'external' || !link.url) return false;
            const linkDomain = extractDomainFromUrl(link.url);
            return linkDomain === targetDomain && link.url !== externalUrl;
          });

          if (partialMatchLink) {
            partialMatches.push({
              id: doc.id,
              title: data.title || 'Untitled',
              username: data.username,
              lastModified: data.lastModified,
              matchType: 'partial',
              matchedUrl: partialMatchLink.url
            });
          }
        }
      } catch (error) {
        continue;
      }
    }

    // Return exact matches first, then partial matches, up to the limit
    const result = [...exactMatches, ...partialMatches].slice(0, limitCount);
    return result;
  } catch (error) {
    return [];
  }
};

/**
 * Extract user mentions from content
 */
export const extractUserMentions = (content: string | EditorContent): string[] => {
  const userIds: string[] = [];

  try {
    let nodes: EditorContent = [];

    if (typeof content === 'string') {
      nodes = JSON.parse(content);
    } else if (Array.isArray(content)) {
      nodes = content;
    }

    const links = extractLinksFromNodes(nodes);

    links.forEach(link => {
      if (link.type === 'user' && link.userId) {
        userIds.push(link.userId);
      }
    });
  } catch (error) {
    // Silent error handling
  }

  // Remove duplicates
  return [...new Set(userIds)];
};

/**
 * Find pages by a specific user that link to a specific external URL
 * Returns both exact matches and partial matches (same domain, different path)
 *
 * OPTIMIZED: Uses the external links index for O(1) lookups instead of scanning all user pages.
 * Falls back to the legacy scan method if the index query fails.
 */
export const findUserPagesLinkingToExternalUrl = async (
  externalUrl: string,
  userId: string,
  currentUserId: string | null = null
): Promise<RelatedPageResult[]> => {
  try {
    // Try the indexed version first (fast O(1) lookup)
    // Only runs on server-side since externalLinksIndexService uses firebase-admin
    if (typeof window === 'undefined') {
      try {
        const { findUserPagesLinkingToExternalUrlIndexed } = await import('../../services/externalLinksIndexService');
        const indexedResults = await findUserPagesLinkingToExternalUrlIndexed(externalUrl, userId);

        // If we got results from the index, use them
        if (indexedResults.length > 0) {
          return indexedResults;
        }
        // If no results, fall through to legacy method
      } catch (indexError) {
        // Index query failed, fall back to legacy method
        console.warn('[findUserPagesLinkingToExternalUrl] Index query failed, using legacy scan:', indexError);
      }
    }

    // Legacy fallback: Scan user pages
    // Import required functions
    const { getUserPages } = await import('./users');

    // Determine if we should include private pages
    const includePrivate = currentUserId === userId;

    // Get all user's pages
    const { pages } = await getUserPages(userId, includePrivate, currentUserId);

    const targetDomain = extractDomainFromUrl(externalUrl);
    const exactMatches: RelatedPageResult[] = [];
    const partialMatches: RelatedPageResult[] = [];

    // Process each page to find ones that contain the external URL
    for (const page of pages) {
      // Skip pages without content
      if (!page.content) continue;

      try {
        let content: EditorContent = [];

        // Parse content if it's a string
        if (typeof page.content === 'string') {
          content = JSON.parse(page.content);
        } else if (Array.isArray(page.content)) {
          content = page.content;
        }

        // Extract links from the page content
        const links = extractLinksFromNodes(content);

        // Check for exact match first
        const hasExactMatch = links.some(link =>
          link.type === 'external' && link.url === externalUrl
        );

        if (hasExactMatch) {
          exactMatches.push({
            id: page.id,
            title: page.title || 'Untitled',
            username: page.username,
            lastModified: page.lastModified,
            matchType: 'exact'
          });
        } else if (targetDomain) {
          // Check for partial match (same domain, different URL)
          const partialMatchLink = links.find(link => {
            if (link.type !== 'external' || !link.url) return false;
            const linkDomain = extractDomainFromUrl(link.url);
            return linkDomain === targetDomain && link.url !== externalUrl;
          });

          if (partialMatchLink) {
            partialMatches.push({
              id: page.id,
              title: page.title || 'Untitled',
              username: page.username,
              lastModified: page.lastModified,
              matchType: 'partial',
              matchedUrl: partialMatchLink.url
            });
          }
        }
      } catch (error) {
        continue;
      }
    }

    // Return exact matches first, then partial matches
    return [...exactMatches, ...partialMatches];
  } catch (error) {
    return [];
  }
};

/**
 * Get all external links from a user's pages
 */
export const getUserExternalLinks = async (
  userId: string,
  currentUserId: string | null = null
): Promise<Array<{
  url: string;
  text: string;
  pageId: string;
  pageTitle: string;
  lastModified?: any;
}>> => {
  try {
    // Import required functions
    const { getUserPages } = await import('./users');

    // Determine if we should include private pages
    const includePrivate = currentUserId === userId;

    // Get all user's pages
    const { pages } = await getUserPages(userId, includePrivate, currentUserId);

    // Array to store individual external link entries
    const externalLinkEntries: Array<{
      url: string;
      text: string;
      pageId: string;
      pageTitle: string;
      lastModified?: any;
    }> = [];

    // Process each page to extract external links
    for (const page of pages) {
      // Skip pages without content
      if (!page.content) continue;

      try {
        let content: EditorContent = [];

        // Parse content if it's a string
        if (typeof page.content === 'string') {
          content = JSON.parse(page.content);
        } else if (Array.isArray(page.content)) {
          content = page.content;
        }

        // Extract links from the page content
        const links = extractLinksFromNodes(content);

        // Filter for external links only - be extra strict
        const externalLinks = links.filter(link => {
          if (link.type !== 'external') return false;
          if (!link.url) return false;

          // Additional checks to ensure it's truly external
          const url = link.url.toLowerCase();

          // Must have a protocol
          if (!url.startsWith('http://') && !url.startsWith('https://')) return false;

          // Must not be a WeWrite domain
          if (url.includes('wewrite.app') || url.includes('localhost:3000') || url.includes('localhost')) return false;

          // Must not be a relative path that somehow got through
          if (url.startsWith('/')) return false;

          return true;
        });

        // Add each external link as a separate entry
        externalLinks.forEach(link => {
          if (!link.url) return;

          externalLinkEntries.push({
            url: link.url,
            text: link.text || link.url,
            pageId: page.id,
            pageTitle: page.title || 'Untitled',
            lastModified: page.lastModified
          });
        });
      } catch (error) {
        continue;
      }
    }

    // Sort by URL first, then by page title for consistent ordering
    externalLinkEntries.sort((a, b) => {
      const urlComparison = a.url.localeCompare(b.url);
      if (urlComparison !== 0) return urlComparison;
      return a.pageTitle.localeCompare(b.pageTitle);
    });

    return externalLinkEntries;
  } catch (error) {
    return [];
  }
};

/**
 * Get aggregated external links from a user's pages with global counts
 */
export const getUserExternalLinksAggregated = async (
  userId: string,
  currentUserId: string | null = null,
  sortBy: 'recent' | 'oldest' | 'most_linked' | 'least_linked' = 'recent'
): Promise<Array<{
  url: string;
  text: string;
  globalCount: number;
  userCount: number;
  pages: Array<{
    pageId: string;
    pageTitle: string;
    lastModified?: any;
  }>;
  mostRecentModified?: any;
  oldestModified?: any;
}>> => {
  try {
    // Get all individual external link entries for this user
    const externalLinkEntries = await getUserExternalLinks(userId, currentUserId);

    // Group by URL
    const linkGroups = new Map<string, {
      url: string;
      text: string;
      pages: Array<{
        pageId: string;
        pageTitle: string;
        lastModified?: any;
      }>;
      mostRecentModified?: any;
      oldestModified?: any;
    }>();

    externalLinkEntries.forEach(entry => {
      if (!linkGroups.has(entry.url)) {
        linkGroups.set(entry.url, {
          url: entry.url,
          text: entry.text,
          pages: [],
          mostRecentModified: entry.lastModified,
          oldestModified: entry.lastModified
        });
      }

      const group = linkGroups.get(entry.url)!;

      // Add page if not already included
      const existingPage = group.pages.find(p => p.pageId === entry.pageId);
      if (!existingPage) {
        group.pages.push({
          pageId: entry.pageId,
          pageTitle: entry.pageTitle,
          lastModified: entry.lastModified
        });
      }

      // Update most recent and oldest modified dates
      if (entry.lastModified) {
        if (!group.mostRecentModified || entry.lastModified > group.mostRecentModified) {
          group.mostRecentModified = entry.lastModified;
        }
        if (!group.oldestModified || entry.lastModified < group.oldestModified) {
          group.oldestModified = entry.lastModified;
        }
      }
    });

    // Get global counts for all URLs efficiently
    const urls = Array.from(linkGroups.keys());
    const globalCounts = await getGlobalExternalLinkCounts(urls);

    // Create aggregated links with global counts
    const aggregatedLinks = Array.from(linkGroups.values()).map(group => ({
      url: group.url,
      text: group.text,
      globalCount: globalCounts.get(group.url) || 0,
      userCount: group.pages.length,
      pages: group.pages,
      mostRecentModified: group.mostRecentModified,
      oldestModified: group.oldestModified
    }));

    // Sort based on the requested sort option
    aggregatedLinks.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          // Most recently modified first
          if (!a.mostRecentModified && !b.mostRecentModified) return 0;
          if (!a.mostRecentModified) return 1;
          if (!b.mostRecentModified) return -1;
          return b.mostRecentModified.localeCompare(a.mostRecentModified);

        case 'oldest':
          // Oldest modified first
          if (!a.oldestModified && !b.oldestModified) return 0;
          if (!a.oldestModified) return 1;
          if (!b.oldestModified) return -1;
          return a.oldestModified.localeCompare(b.oldestModified);

        case 'most_linked':
          // Most linked globally first
          return b.globalCount - a.globalCount;

        case 'least_linked':
          // Least linked globally first
          return a.globalCount - b.globalCount;

        default:
          return 0;
      }
    });

    return aggregatedLinks;
  } catch (error) {
    return [];
  }
};

/**
 * Get aggregated external links from a group's pages with global counts
 * Follows the same pattern as getUserExternalLinksAggregated but queries by groupId
 */
export const getGroupExternalLinksAggregated = async (
  groupId: string,
  currentUserId: string | null = null,
  sortBy: 'recent' | 'oldest' | 'most_linked' | 'least_linked' = 'recent'
): Promise<Array<{
  url: string;
  text: string;
  globalCount: number;
  userCount: number;
  pages: Array<{
    pageId: string;
    pageTitle: string;
    lastModified?: any;
  }>;
  mostRecentModified?: any;
  oldestModified?: any;
}>> => {
  try {
    const { db } = await import('../config');
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    const { getCollectionName } = await import('../../utils/environmentConfig');

    // Get all group's pages
    const pagesQuery = query(
      collection(db, getCollectionName('pages')),
      where('groupId', '==', groupId)
    );

    const snapshot = await getDocs(pagesQuery);

    // Extract external links from each page
    const externalLinkEntries: Array<{
      url: string;
      text: string;
      pageId: string;
      pageTitle: string;
      lastModified?: any;
    }> = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.deleted === true) continue;
      if (!data.content) continue;

      try {
        let content: EditorContent = [];
        if (typeof data.content === 'string') {
          content = JSON.parse(data.content);
        } else if (Array.isArray(data.content)) {
          content = data.content;
        }

        const links = extractLinksFromNodes(content);
        const externalLinks = links.filter(link => {
          if (link.type !== 'external') return false;
          if (!link.url) return false;
          const url = link.url.toLowerCase();
          if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
          if (url.includes('wewrite.app') || url.includes('localhost:3000') || url.includes('localhost')) return false;
          if (url.startsWith('/')) return false;
          return true;
        });

        externalLinks.forEach(link => {
          if (!link.url) return;
          externalLinkEntries.push({
            url: link.url,
            text: link.text || link.url,
            pageId: doc.id,
            pageTitle: data.title || 'Untitled',
            lastModified: data.lastModified,
          });
        });
      } catch {
        continue;
      }
    }

    // Group by URL
    const linkGroups = new Map<string, {
      url: string;
      text: string;
      pages: Array<{ pageId: string; pageTitle: string; lastModified?: any }>;
      mostRecentModified?: any;
      oldestModified?: any;
    }>();

    externalLinkEntries.forEach(entry => {
      if (!linkGroups.has(entry.url)) {
        linkGroups.set(entry.url, {
          url: entry.url,
          text: entry.text,
          pages: [],
          mostRecentModified: entry.lastModified,
          oldestModified: entry.lastModified,
        });
      }
      const group = linkGroups.get(entry.url)!;
      const existingPage = group.pages.find(p => p.pageId === entry.pageId);
      if (!existingPage) {
        group.pages.push({
          pageId: entry.pageId,
          pageTitle: entry.pageTitle,
          lastModified: entry.lastModified,
        });
      }
      if (entry.lastModified) {
        if (!group.mostRecentModified || entry.lastModified > group.mostRecentModified) {
          group.mostRecentModified = entry.lastModified;
        }
        if (!group.oldestModified || entry.lastModified < group.oldestModified) {
          group.oldestModified = entry.lastModified;
        }
      }
    });

    // Get global counts
    const urls = Array.from(linkGroups.keys());
    const globalCounts = await getGlobalExternalLinkCounts(urls);

    const aggregatedLinks = Array.from(linkGroups.values()).map(group => ({
      url: group.url,
      text: group.text,
      globalCount: globalCounts.get(group.url) || 0,
      userCount: group.pages.length,
      pages: group.pages,
      mostRecentModified: group.mostRecentModified,
      oldestModified: group.oldestModified,
    }));

    aggregatedLinks.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          if (!a.mostRecentModified && !b.mostRecentModified) return 0;
          if (!a.mostRecentModified) return 1;
          if (!b.mostRecentModified) return -1;
          return b.mostRecentModified.localeCompare(a.mostRecentModified);
        case 'oldest':
          if (!a.oldestModified && !b.oldestModified) return 0;
          if (!a.oldestModified) return 1;
          if (!b.oldestModified) return -1;
          return a.oldestModified.localeCompare(b.oldestModified);
        case 'most_linked':
          return b.globalCount - a.globalCount;
        case 'least_linked':
          return a.globalCount - b.globalCount;
        default:
          return 0;
      }
    });

    return aggregatedLinks;
  } catch (error) {
    return [];
  }
};

/**
 * Get the global count of how many times an external URL is linked across all pages
 * OPTIMIZED: Uses caching to reduce expensive full-collection scans
 */
export const getGlobalExternalLinkCount = async (externalUrl: string): Promise<number> => {
  try {
    // Import caching utilities
    const { getCacheItem, setCacheItem, generateCacheKey } = await import('../../utils/cacheUtils');

    // Check cache first (6 hour TTL for link counts)
    const cacheKey = generateCacheKey('global_link_count', externalUrl);
    const cached = getCacheItem<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const { db } = await import('../config');
    const { collection, query, where, getDocs, limit } = await import('firebase/firestore');

    // Import environment config
    const { getCollectionName } = await import('../../utils/environmentConfig');

    // Optimized query with limit to reduce costs
    const pagesQuery = query(
      collection(db, getCollectionName('pages')),
      where('deleted', '!=', true),
      limit(1000) // Limit to reduce read costs
    );

    const snapshot = await getDocs(pagesQuery);
    let count = 0;

    // Search through page content for the external URL
    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Skip if no content
      if (!data.content) continue;

      try {
        // Extract links from the page content
        const links = extractLinksFromNodes(data.content);

        // Count occurrences of the external URL in this page
        const urlCount = links.filter(link =>
          link.type === 'external' && link.url === externalUrl
        ).length;

        count += urlCount;
      } catch (error) {
        continue;
      }
    }

    // Cache the result for 6 hours to reduce future reads
    setCacheItem(cacheKey, count, 6 * 60 * 60 * 1000);

    return count;
  } catch (error) {
    return 0;
  }
};

/**
 * Get global counts for multiple external URLs efficiently
 */
export const getGlobalExternalLinkCounts = async (urls: string[]): Promise<Map<string, number>> => {
  const counts = new Map<string, number>();

  // Initialize all URLs with 0 count
  urls.forEach(url => counts.set(url, 0));

  try {
    const { db } = await import('../config');
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    const { getCollectionName } = await import('../../utils/environmentConfig');

    // Query pages only
    const pagesQuery = query(
      collection(db, getCollectionName('pages')),
      where('deleted', '!=', true)
    );

    const snapshot = await getDocs(pagesQuery);

    // Search through page content for all external URLs
    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Skip if no content
      if (!data.content) continue;

      try {
        // Extract links from the page content
        const links = extractLinksFromNodes(data.content);

        // Count occurrences of each URL in this page
        links.forEach(link => {
          if (link.type === 'external' && link.url && urls.includes(link.url)) {
            const currentCount = counts.get(link.url) || 0;
            counts.set(link.url, currentCount + 1);
          }
        });
      } catch (error) {
        continue;
      }
    }

    return counts;
  } catch (error) {
    return counts;
  }
};

/**
 * Convert plain text URLs to link objects
 */
export const convertTextToLinks = (text: string): EditorContent => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  const nodes: EditorContent = [];
  
  parts.forEach(part => {
    if (part.match(urlRegex)) {
      // This is a URL
      nodes.push({
        type: 'link',
        url: part,
        children: [{ text: part }]
      });
    } else if (part.trim()) {
      // This is regular text
      nodes.push({
        type: 'paragraph',
        children: [{ text: part }]
      });
    }
  });
  
  return nodes.length > 0 ? nodes : [{ type: 'paragraph', children: [{ text }] }];
};

/**
 * Sanitize and normalize link URLs
 */
export const sanitizeLinkUrl = (url: string): string => {
  if (!url) return '';
  
  // Remove any dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:'];
  const lowerUrl = url.toLowerCase();
  
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return '';
    }
  }
  
  // Ensure external URLs have proper protocol
  if (!url.startsWith('/') && !url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  
  return url;
};