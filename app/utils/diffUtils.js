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

      // Compare children (text nodes)
      if (currentParagraph.children && previousParagraph.children) {
        // Mark text as added or removed based on simple comparison
        // This is a simplified approach - a real diff algorithm would be more sophisticated
        const currentText = extractTextFromChildren(currentParagraph.children);
        const previousText = extractTextFromChildren(previousParagraph.children);

        if (currentText !== previousText) {
          // Mark the entire paragraph as changed
          // In a real implementation, you'd want to do a more granular diff
          currentParagraph.children.forEach(child => {
            if (child.text) {
              // If text is in current but not in previous, mark as added
              if (!previousText.includes(child.text)) {
                child.added = true;
              }
            }
          });

          // Add removed text from previous paragraph
          previousParagraph.children.forEach(child => {
            if (child.text && !currentText.includes(child.text)) {
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
    if (child.text) {
      return text + child.text;
    }
    if (child.children) {
      return text + extractTextFromChildren(child.children);
    }
    return text;
  }, '');
}
