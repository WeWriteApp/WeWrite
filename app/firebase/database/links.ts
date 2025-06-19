import type { LinkData, SlateContent } from "../../types/database";

/**
 * Extract links from Slate.js content nodes
 */
export const extractLinksFromNodes = (nodes: SlateContent[]): LinkData[] => {
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

      // ENHANCED: Check for direct pageId property first (most reliable)
      if (node.pageId) {
        linkData.type = 'page';
        linkData.pageId = node.pageId;
      }
      // ENHANCED: Check for direct userId property
      else if (node.userId) {
        linkData.type = 'user';
        linkData.userId = node.userId;
      }
      // ENHANCED: Check for isExternal flag
      else if (node.isExternal) {
        linkData.type = 'external';
      }
      // Fallback: Check URL patterns
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

  // Remove duplicates based on URL
  const uniqueLinks = links.filter((link, index, self) =>
    index === self.findIndex(l => l.url === link.url)
  );

  return uniqueLinks;
};

/**
 * Find backlinks to a specific page
 */
export const findBacklinks = async (pageId: string, limitCount: number = 10): Promise<Array<{
  id: string;
  title: string;
  username?: string;
  lastModified: any;
  isPublic: boolean;
}>> => {
  try {
    console.log(`Finding backlinks for page ${pageId} (limit: ${limitCount})`);

    const { db } = await import('../config');
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');

    // Query for public pages that might contain links to our target page
    const pagesQuery = query(
      collection(db, 'pages'),
      where('isPublic', '==', true),
      where('deleted', '!=', true),
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
    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Skip the target page itself
      if (doc.id === pageId) continue;

      // Skip if no content
      if (!data.content) continue;

      try {
        // Parse content if it's a string
        let contentNodes: SlateContent[] = [];
        if (typeof data.content === 'string') {
          contentNodes = JSON.parse(data.content);
        } else if (Array.isArray(data.content)) {
          contentNodes = data.content;
        } else {
          continue; // Skip if content format is unexpected
        }

        // Extract links from the page content
        const links = extractLinksFromNodes(contentNodes);

        // Enhanced debug logging for the first few pages
        if (backlinks.length < 3) {
          console.log(`[DEBUG] Page ${doc.id} (${data.title}) has ${links.length} links:`,
            links.map(l => ({
              url: l.url,
              type: l.type,
              pageId: l.pageId,
              userId: l.userId,
              text: l.text?.substring(0, 50) + (l.text?.length > 50 ? '...' : '')
            })));
          console.log(`[DEBUG] Looking for links to pageId: ${pageId}`);
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
              return urlPageId === pageId;
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
          console.log(`[DEBUG] Found backlink: Page ${doc.id} (${data.title}) links to ${pageId}`);
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

    console.log(`Found ${backlinks.length} backlinks for page ${pageId}`);
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
export const extractPageReferences = (content: string | SlateContent[]): string[] => {
  const pageIds: string[] = [];

  try {
    let nodes: SlateContent[] = [];

    if (typeof content === 'string') {
      nodes = JSON.parse(content);
    } else if (Array.isArray(content)) {
      nodes = content;
    }

    const links = extractLinksFromNodes(nodes);

    links.forEach(link => {
      if (link.type === 'page' && link.pageId) {
        pageIds.push(link.pageId);
      }
    });
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

    // Query for public pages that might contain the external URL
    // Note: This is a simplified approach. For better performance, you might want to
    // index external links separately or use full-text search
    const pagesQuery = query(
      collection(db, 'pages'),
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
export const extractUserMentions = (content: string | SlateContent[]): string[] => {
  const userIds: string[] = [];
  
  try {
    let nodes: SlateContent[] = [];
    
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
 * Convert plain text URLs to link objects
 */
export const convertTextToLinks = (text: string): SlateContent[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  const nodes: SlateContent[] = [];
  
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
