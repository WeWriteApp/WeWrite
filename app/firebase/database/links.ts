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
  console.warn('⚠️ findBacklinks is deprecated. Use getBacklinks from backlinks.ts for better performance.');

  // Use the new efficient backlinks system
  try {
    const { getBacklinks } = await import('./backlinks');
    return await getBacklinks(pageId, limitCount);
  } catch (error) {
    console.error('Error using new backlinks system, falling back to old method:', error);
    // Fall back to the old inefficient method if the new one fails
  }
  try {
    console.log(`Finding backlinks for page ${pageId} (limit: ${limitCount})`);

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
    console.log(`Found ${snapshot.docs.length} pages to search through`);

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
            console.warn(`Failed to parse content for page ${doc.id}:`, parseError);
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
          // Debug logging for link matching
          if (links.length > 0 && pagesProcessed <= 5) { // Only log for first few pages to avoid spam
            console.log(`    Checking link: type=${link.type}, url=${link.url}, pageId=${link.pageId}, target=${pageId}`);
          }

          // Check for page links that match our target
          if (link.type === 'page' && link.pageId === pageId) {
            if (pagesProcessed <= 5) {
              console.log(`    ✅ Match found via pageId: ${link.pageId} === ${pageId}`);
            }
            return true;
          }

          // Check for URL-based links that match our target
          if (link.url) {
            // Handle /pages/pageId format
            if (link.url.startsWith('/pages/')) {
              const urlPageId = link.url.replace('/pages/', '').split(/[\/\?#]/)[0];
              if (urlPageId === pageId) {
                if (pagesProcessed <= 5) {
                  console.log(`    ✅ Match found via /pages/ URL: ${urlPageId} === ${pageId}`);
                }
                return true;
              }
            }

            // Handle /pageId format (direct page links)
            if (link.url.startsWith('/') && link.url.length > 1) {
              const urlPageId = link.url.substring(1).split(/[\/\?#]/)[0];
              // Only match if it's a simple page ID (no additional path segments)
              if (!urlPageId.includes('/') && urlPageId === pageId) {
                if (pagesProcessed <= 5) {
                  console.log(`    ✅ Match found via direct URL: ${urlPageId} === ${pageId}`);
                }
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
        console.error(`Error processing page ${doc.id} for backlinks:`, error);
        continue;
      }
    }

    console.log(`Backlinks search completed for page ${pageId}:`);
    console.log(`  - Pages processed: ${pagesProcessed}`);
    console.log(`  - Pages with content: ${pagesWithContent}`);
    console.log(`  - Pages with links: ${pagesWithLinks}`);
    console.log(`  - Backlinks found: ${backlinks.length}`);

    return backlinks;
  } catch (error) {
    console.error("Error finding backlinks:", error);
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
    console.error("Error validating link URL:", error);
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

    // Debug logging for the specific page we're testing
    if (typeof content === 'string' && content.includes('V02vyPf2YYgwz18M8JTd')) {
      console.log(`🔗 [DEBUG] extractPageReferences - Found ${links.length} total links:`, links.map(l => ({ type: l.type, pageId: l.pageId, text: l.text, isExternal: l.isExternal })));
    }

    links.forEach(link => {
      // Accept both 'page' and 'link' types, and ensure it's not external
      if (link.pageId && !link.isExternal) {
        pageIds.push(link.pageId);
      }
    });

    if (typeof content === 'string' && content.includes('V02vyPf2YYgwz18M8JTd')) {
      console.log(`🔗 [DEBUG] extractPageReferences - Filtered to ${pageIds.length} page IDs:`, pageIds);
    }
  } catch (error) {
    console.error("Error extracting page references:", error);
  }

  // Remove duplicates
  return [...new Set(pageIds)];
};

/**
 * Find pages that link to a specific external URL
 */
export const findPagesLinkingToExternalUrl = async (
  externalUrl: string,
  limitCount: number = 5
): Promise<Array<{
  id: string;
  title: string;
  username?: string;
  lastModified: any;
}>> => {
  try {
    const { db } = await import('../config');
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');

    // Query for pages that might contain the external URL
    // Note: This is a simplified approach. For better performance, you might want to
    // index external links separately or use full-text search
    const pagesQuery = query(
      collection(db, getCollectionName('pages')),
      where('isPublic', '==', true),
      where('deleted', '!=', true),
      orderBy('lastModified', 'desc'),
      limit(50) // Get more pages to search through
    );

    const snapshot = await getDocs(pagesQuery);
    const matchingPages: Array<{
      id: string;
      title: string;
      username?: string;
      lastModified: any;
    }> = [];

    // Search through page content for the external URL
    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Skip if no content
      if (!data.content) continue;

      try {
        // Extract links from the page content
        const links = extractLinksFromNodes(data.content);

        // Check if any link matches our external URL
        const hasMatchingLink = links.some(link =>
          link.type === 'external' && link.url === externalUrl
        );

        if (hasMatchingLink) {
          matchingPages.push({
            id: doc.id,
            title: data.title || 'Untitled',
            username: data.username,
            lastModified: data.lastModified
          });

          // Stop when we have enough results
          if (matchingPages.length >= limitCount) {
            break;
          }
        }
      } catch (error) {
        console.error(`Error processing page ${doc.id}:`, error);
        continue;
      }
    }

    return matchingPages;
  } catch (error) {
    console.error("Error finding pages linking to external URL:", error);
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
    console.error("Error extracting user mentions:", error);
  }

  // Remove duplicates
  return [...new Set(userIds)];
};

/**
 * Find pages by a specific user that link to a specific external URL
 */
export const findUserPagesLinkingToExternalUrl = async (
  externalUrl: string,
  userId: string,
  currentUserId: string | null = null
): Promise<Array<{
  id: string;
  title: string;
  username?: string;
  lastModified: any;
}>> => {
  try {
    // Import required functions
    const { getUserPages } = await import('./users');

    // Determine if we should include private pages
    const includePrivate = currentUserId === userId;

    // Get all user's pages
    const { pages } = await getUserPages(userId, includePrivate, currentUserId);

    const matchingPages: Array<{
      id: string;
      title: string;
      username?: string;
      lastModified: any;
    }> = [];

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

        // Check if any link matches our external URL
        const hasMatchingLink = links.some(link =>
          link.type === 'external' && link.url === externalUrl
        );

        if (hasMatchingLink) {
          matchingPages.push({
            id: page.id,
            title: page.title || 'Untitled',
            username: page.username,
            lastModified: page.lastModified
          });
        }
      } catch (error) {
        console.error(`Error processing page ${page.id} for external URL:`, error);
        continue;
      }
    }

    return matchingPages;
  } catch (error) {
    console.error("Error finding user pages linking to external URL:", error);
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
        console.error(`Error processing page ${page.id} for external links:`, error);
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
    console.error("Error getting user external links:", error);
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
    console.error("Error getting aggregated user external links:", error);
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
      where('isPublic', '==', true),
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
        console.error(`Error processing page ${doc.id} for global count:`, error);
        continue;
      }
    }

    // Cache the result for 6 hours to reduce future reads
    setCacheItem(cacheKey, count, 6 * 60 * 60 * 1000);

    return count;
  } catch (error) {
    console.error("Error getting global external link count:", error);
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
      where('isPublic', '==', true),
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
        console.error(`Error processing page ${doc.id} for global counts:`, error);
        continue;
      }
    }

    return counts;
  } catch (error) {
    console.error("Error getting global external link counts:", error);
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