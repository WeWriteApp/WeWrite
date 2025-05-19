/**
 * Utility functions for generating diff content between two versions
 */

/**
 * Generates a diff between two Slate content arrays
 * Marks added and removed text in the content
 *
 * @param {Array} currentContent - Current content array
 * @param {Array} previousContent - Previous content array
 * @returns {Array} Content array with diff markers
 */
export function generateDiffContent(currentContent, previousContent) {
  if (!currentContent || !previousContent) {
    return currentContent;
  }

  try {
    // Log the content for debugging
    console.log('DIFF_DEBUG: Generating diff between contents:', {
      currentType: typeof currentContent,
      previousType: typeof previousContent,
      currentLength: typeof currentContent === 'string' ? currentContent.length : Array.isArray(currentContent) ? currentContent.length : 'unknown',
      previousLength: typeof previousContent === 'string' ? previousContent.length : Array.isArray(previousContent) ? previousContent.length : 'unknown'
    });

    // Parse content if needed
    const current = typeof currentContent === 'string' ? JSON.parse(currentContent) : currentContent;
    const previous = typeof previousContent === 'string' ? JSON.parse(previousContent) : previousContent;

    // Create a deep copy of the current content to modify
    const diffContent = JSON.parse(JSON.stringify(current));

    // Simple diff algorithm - compare paragraphs
    const minLength = Math.min(diffContent.length, previous.length);

    // Log the parsed content structure
    console.log('DIFF_DEBUG: Parsed content structures:', {
      currentLength: Array.isArray(current) ? current.length : 'not array',
      previousLength: Array.isArray(previous) ? previous.length : 'not array',
      minLength
    });

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
        // Log paragraph children for debugging
        console.log(`DIFF_DEBUG: Comparing paragraph ${i}:`, {
          currentChildren: currentParagraph.children.length,
          previousChildren: previousParagraph.children.length
        });

        // Check for links in the paragraph
        const currentLinks = currentParagraph.children.filter(child => child.type === 'link');
        const previousLinks = previousParagraph.children.filter(child => child.type === 'link');

        if (currentLinks.length > 0 || previousLinks.length > 0) {
          console.log(`DIFF_DEBUG: Paragraph ${i} contains links:`, {
            currentLinks: currentLinks.length,
            previousLinks: previousLinks.length
          });

          // Log the links for debugging
          if (currentLinks.length > 0) {
            currentLinks.forEach((link, j) => {
              console.log(`DIFF_DEBUG: Current link ${j}:`, JSON.stringify(link));
            });
          }

          if (previousLinks.length > 0) {
            previousLinks.forEach((link, j) => {
              console.log(`DIFF_DEBUG: Previous link ${j}:`, JSON.stringify(link));
            });
          }

          // Mark added links
          currentLinks.forEach(currentLink => {
            const linkExists = previousLinks.some(prevLink =>
              prevLink.url === currentLink.url &&
              extractTextFromChildren(prevLink.children) === extractTextFromChildren(currentLink.children)
            );

            if (!linkExists) {
              console.log('DIFF_DEBUG: Marking link as added:', currentLink.url);
              currentLink.added = true;
              // Also mark the link's children as added
              if (currentLink.children) {
                currentLink.children.forEach(child => {
                  child.added = true;
                });
              }
            }
          });

          // Add removed links
          previousLinks.forEach(prevLink => {
            const linkExists = currentLinks.some(currentLink =>
              currentLink.url === prevLink.url &&
              extractTextFromChildren(currentLink.children) === extractTextFromChildren(prevLink.children)
            );

            if (!linkExists) {
              console.log('DIFF_DEBUG: Adding removed link:', prevLink.url);
              // Create a copy of the link with removed flag
              const removedLink = { ...prevLink, removed: true };
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
          console.log(`DIFF_DEBUG: Text differs in paragraph ${i}`);

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

    // Handle link nodes specifically
    if (child.type === 'link') {
      let linkText = '';

      // Extract text from link children
      if (child.children) {
        linkText = extractTextFromChildren(child.children);
      }

      // If no text was extracted, use URL as fallback
      if (!linkText && child.url) {
        linkText = child.url;
      }

      // Add special markers to indicate it's a link
      return text + `[${linkText}]`;
    }

    // Handle other node types with children
    if (child.children) {
      return text + extractTextFromChildren(child.children);
    }

    return text;
  }, '');
}
