import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import { $getSelection, $isRangeSelection, $createTextNode, $getRoot, COMMAND_PRIORITY_EDITOR,$createParagraphNode, $createRangeSelection,$createNodeSelection, $setSelection

 } from 'lexical';
import { $createCustomLinkNode } from './CustomLinkNode';
import { validateLink } from '../utils/linkValidator';

const INSERT_CUSTOM_LINK_COMMAND = 'INSERT_CUSTOM_LINK_COMMAND';

function insertCustomLink(editor, url, text) {
  if (!url || !text) {
    console.error('URL or text is undefined');
    return;
  }

  // Determine if this is an external link
  const isExternal = url.startsWith('http://') || url.startsWith('https://');

  // Extract pageId from URL if it's a page link
  let pageId = null;
  if (url.includes('/pages/')) {
    const match = url.match(/\/pages\/([a-zA-Z0-9-_]+)/);
    if (match) {
      pageId = match[1];
    }
  }

  // Create a basic link object for validation
  const basicLink = {
    type: "link",
    url: url,
    children: [{ text: text }],
    isExternal: isExternal,
    pageId: pageId,
    displayText: text
  };

  // CRITICAL FIX: Use validateLink to ensure all required properties are present
  // This ensures backward compatibility with both old and new link formats
  const validatedLink = validateLink(basicLink);
  console.log('CustomLinkPlugin: Validated link:', JSON.stringify(validatedLink));

  editor.update(() => {
    // get the current selection
    const selection = $getSelection();

    // Save the current selection point for accurate insertion
    const currentSelection = selection ? selection.clone() : null;
    console.log('CustomLinkPlugin: Current selection:', currentSelection);

    // Create the link node with the validated properties
    const linkNode = $createCustomLinkNode(url);
    const textNode = $createTextNode(text);

    linkNode.append(textNode);

    // Store the validated properties on the node for later use
    // This ensures the link will render correctly in view mode
    linkNode.__validatedProps = validatedLink;

    // CRITICAL FIX: Ensure proper insertion at cursor position
    try {
      if ($isRangeSelection(selection)) {
        // Log the selection for debugging
        console.log('CustomLinkPlugin: Inserting at range selection');

        // Insert at the exact current selection
        selection.insertNodes([linkNode]);

        // Move cursor to the end of the link
        selection.collapse();
      } else {
        console.log('CustomLinkPlugin: No range selection, creating new paragraph');

        // Create a new paragraph with the link if no selection
        const root = $getRoot();
        const paragraphNode = $createParagraphNode();
        paragraphNode.append(linkNode);

        // Append to the root
        root.append(paragraphNode);

        // Create a new selection at the end of the link
        const newSelection = $createRangeSelection();
        newSelection.anchor.set(linkNode.getKey(), 0, 'end');
        newSelection.focus.set(linkNode.getKey(), 0, 'end');
        $setSelection(newSelection);
      }
    } catch (error) {
      console.error('CustomLinkPlugin: Error during link insertion:', error);
      // Fallback to simpler insertion
      const root = $getRoot();
      const paragraphNode = $createParagraphNode();
      paragraphNode.append(linkNode);
      root.append(paragraphNode);
    }
  });
}

function CustomLinkPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeCommand = editor.registerCommand(
      INSERT_CUSTOM_LINK_COMMAND,
      (payload) => {
        insertCustomLink(editor, payload.url, payload.text);
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );

    return () => {
      removeCommand();
    };
  }, [editor]);

  return null;
}

export { CustomLinkPlugin, INSERT_CUSTOM_LINK_COMMAND, insertCustomLink };
