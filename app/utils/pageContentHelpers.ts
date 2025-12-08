/**
 * Shared utilities for page content manipulation
 * Used by both ContentPageView and new/page for DRY code
 */

interface PageReference {
  pageId: string;
  title: string;
}

/**
 * Extract new page references from editor content
 * Looks for link nodes marked with isNew flag
 */
export function extractNewPageReferences(content: any[]): PageReference[] {
  const newPages: PageReference[] = [];

  const processNode = (node: any) => {
    if (node.type === 'link' && node.isNew && node.pageId && node.pageTitle) {
      newPages.push({
        pageId: node.pageId,
        title: node.pageTitle
      });
    }

    if (node.children) {
      node.children.forEach(processNode);
    }
  };

  content.forEach(processNode);
  return newPages;
}

/**
 * Create new pages referenced in links before saving the main page
 * This ensures all linked pages exist when the main page is saved
 */
export async function createNewPagesFromLinks(
  newPageRefs: PageReference[],
  userId: string,
  username: string
): Promise<void> {
  if (!userId || newPageRefs.length === 0) return;

  for (const pageRef of newPageRefs) {
    try {
      const pageData = {
        id: pageRef.pageId,
        title: pageRef.title,
        content: JSON.stringify([{ type: 'paragraph', children: [{ text: '' }] }]),
        userId: userId,
        username: username,
        lastModified: new Date().toISOString(),
        isReply: false,
        groupId: null,
        customDate: null
      };

      const response = await fetch('/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pageData),
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Created linked page:', { title: pageRef.title, id: result.id });
      } else {
        let errorMessage = `Failed to create page "${pageRef.title}"`;
        try {
          const errorData = await response.json();
          if (errorData.error || errorData.message) {
            errorMessage = errorData.error || errorData.message;
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
        }
        console.error('Failed to create linked page:', pageRef.title, errorMessage);
      }
    } catch (error) {
      console.error('Error creating linked page:', error);
    }
  }
}

/**
 * Validate that content has actual content (not just empty paragraphs)
 * Returns true if content has text or links
 */
export function hasActualContent(content: any[]): boolean {
  if (!content || !Array.isArray(content)) return false;

  return content.some(node => {
    if (node.children && Array.isArray(node.children)) {
      return node.children.some(child => {
        // Check for text content
        if (child.text && child.text.trim() !== '') {
          return true;
        }
        // Check for link content
        if (child.type === 'link' || child.url) {
          if (child.pageId) {
            return child.pageId !== '#' && child.pageId.trim() !== '' && !child.pageId.includes('#');
          }
          if (child.url) {
            return child.url !== '#' && child.url.trim() !== '';
          }
          return true;
        }
        return false;
      });
    }
    // Check if the node itself is a link
    if (node.type === 'link' || node.url) {
      if (node.pageId) {
        return node.pageId !== '#' && node.pageId.trim() !== '' && !node.pageId.includes('#');
      }
      if (node.url) {
        return node.url !== '#' && node.url.trim() !== '';
      }
      return true;
    }
    return false;
  });
}
