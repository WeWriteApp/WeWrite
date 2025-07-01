/**
 * Utility functions for generating diff content between two versions
 */

/**
 * Slate content node interface for diff operations
 */
interface SlateContentNode {
  type: string;
  children?: SlateTextNode[];
  [key: string]: any;
}

/**
 * Slate text node interface for diff operations
 */
interface SlateTextNode {
  text?: string;
  added?: boolean;
  removed?: boolean;
  [key: string]: any;
}

/**
 * Generates a diff between two Slate content arrays
 * Marks added and removed text in the content
 *
 * @param currentContent - Current content array
 * @param previousContent - Previous content array
 * @returns Content array with diff markers
 */
export function generateDiffContent(
  currentContent: SlateContentNode[] | string,
  previousContent: SlateContentNode[] | string
): SlateContentNode[] {
  if (!currentContent || !previousContent) {
    return currentContent;
  }

  try {

    // Parse content if needed
    const current = typeof currentContent === 'string' ? JSON.parse(currentContent) : currentContent;
    const previous = typeof previousContent === 'string' ? JSON.parse(previousContent) : previousContent;

    // Create a deep copy of the current content to modify
    const diffContent = JSON.parse(JSON.stringify(current));

    // Simple diff algorithm - compare paragraphs
    const minLength = Math.min(diffContent.length, previous.length);

    // Compare each paragraph
    for (let i = 0; i < minLength; i++) {
      const currentParagraph = diffContent[i];
      const previousParagraph = previous[i];

      // Skip if not paragraph nodes
      if (currentParagraph.type !== 'paragraph' || previousParagraph.type !== 'paragraph') {
        continue;
      }

      // Compare children (text nodes and links)
      if (currentParagraph.children && previousParagraph.children) {

        // FIXED: Special handling for links, especially external links
        // First, identify and process links in both paragraphs
        const currentLinks = currentParagraph.children.filter(child =>
          child.type === 'link' || child.isExternal || child.className === 'external-link'
        );

        const previousLinks = previousParagraph.children.filter(child =>
          child.type === 'link' || child.isExternal || child.className === 'external-link'
        );

        if (currentLinks.length > 0 || previousLinks.length > 0) {

          // FIXED: Improved link comparison for external links
          currentLinks.forEach(currentLink => {
            // Determine if this is an external link
            const isExternal =
              currentLink.isExternal === true ||
              currentLink.className === 'external-link' ||
              (currentLink.url && (currentLink.url.startsWith('http://') || currentLink.url.startsWith('https://')));

            // Use different comparison logic for external vs internal links
            const linkExists = previousLinks.some(prevLink => {
              // For external links, just compare URLs
              if (isExternal) {
                return prevLink.url === currentLink.url;
              }

              // For internal links, compare both URL and content
              return prevLink.url === currentLink.url &&
                extractTextFromChildren(prevLink.children) === extractTextFromChildren(currentLink.children);
            });

            if (!linkExists) {
              currentLink.added = true;
              // Also mark the link's children as added
              if (currentLink.children) {
                currentLink.children.forEach(child => {
                  child.added = true;
                });
              }
            }
          });

          // FIXED: Improved removed link handling for external links
          previousLinks.forEach(prevLink => {
            // Determine if this is an external link
            const isExternal =
              prevLink.isExternal === true ||
              prevLink.className === 'external-link' ||
              (prevLink.url && (prevLink.url.startsWith('http://') || prevLink.url.startsWith('https://')));

            // Use different comparison logic for external vs internal links
            const linkExists = currentLinks.some(currentLink => {
              // For external links, just compare URLs
              if (isExternal) {
                return currentLink.url === prevLink.url;
              }

              // For internal links, compare both URL and content
              return currentLink.url === prevLink.url &&
                extractTextFromChildren(currentLink.children) === extractTextFromChildren(prevLink.children);
            });

            if (!linkExists) {
              // Create a copy of the link with removed flag
              const removedLink = {
                ...prevLink,
                removed: true,
                // Ensure we preserve external link properties
                isExternal: isExternal,
                className: prevLink.className || (isExternal ? 'external-link' : undefined)
              };
              // Also mark the link's children as removed
              if (removedLink.children) {
                removedLink.children = removedLink.children.map(child => ({
                  ...child,
                  removed: true
                }));
              }
              // Add to the current paragraph children
              currentParagraph.children.push(removedLink);
            }
          });
        }

        // Also compare text nodes as before
        const currentText = extractTextFromChildren(currentParagraph.children);
        const previousText = extractTextFromChildren(previousParagraph.children);

        if (currentText !== previousText) {
          // Mark text nodes as added or removed
          currentParagraph.children.forEach(child => {
            if (child.text && !child.added) {
              // If text is in current but not in previous, mark as added
              if (!previousText.includes(child.text)) {
                child.added = true;
              }
            }
          });

          // Add removed text from previous paragraph
          previousParagraph.children.forEach(child => {
            if (child.text && !currentText.includes(child.text) && !child.removed) {
              // Create a copy of the child with removed flag
              const removedChild = { ...child, removed: true };
              // Add to the current paragraph children
              currentParagraph.children.push(removedChild);
            }
          });
        }
      }
    }

    // Mark paragraphs that exist in current but not in previous as added
    for (let i = previous.length; i < diffContent.length; i++) {
      if (diffContent[i].type === 'paragraph' && diffContent[i].children) {
        diffContent[i].children.forEach(child => {
          if (child.text) {
            child.added = true;
          }
        });
      }
    }

    // Add paragraphs that exist in previous but not in current as removed
    for (let i = diffContent.length; i < previous.length; i++) {
      if (previous[i].type === 'paragraph' && previous[i].children) {
        const removedParagraph = {
          type: 'paragraph',
          children: previous[i].children.map(child => {
            if (child.text) {
              return { ...child, removed: true };
            }
            return child;
          })
        };
        diffContent.push(removedParagraph);
      }
    }

    return diffContent;
  } catch (error) {
    console.error('Error generating diff content:', error);
    return currentContent;
  }
}

/**
 * Extracts text from children array
 *
 * @param {Array} children - Array of child nodes
 * @returns {string} Concatenated text
 */
function extractTextFromChildren(children) {
  if (!children || !Array.isArray(children)) {
    return '';
  }

  return children.reduce((text, child) => {
    // Handle text nodes
    if (child.text) {
      return text + child.text;
    }

    // FIXED: Better handling of link nodes, especially external links
    if (child.type === 'link' || child.isExternal || child.className === 'external-link') {
      let linkText = '';

      // Extract text from link children
      if (child.children) {
        linkText = extractTextFromChildren(child.children);
      }

      // If no text was extracted, use URL as fallback
      if (!linkText && child.url) {
        linkText = child.url;
      }

      // Determine if this is an external link
      const isExternal =
        child.isExternal === true ||
        child.className === 'external-link' ||
        (child.url && (child.url.startsWith('http://') || child.url.startsWith('https://')));

      // Add special markers to indicate it's a link, with different format for external links
      if (isExternal) {
        return text + `[${linkText}→]`; // Arrow indicates external link
      } else {
        return text + `[${linkText}]`;
      }
    }

    // Handle other node types with children
    if (child.children) {
      return text + extractTextFromChildren(child.children);
    }

    return text;
  }, '');
}