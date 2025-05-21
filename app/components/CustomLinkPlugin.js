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

  // Create a basic link object for validation
  const basicLink = {
    type: "link",
    url: url,
    children: [{ text: text }],
    isExternal: isExternal
  };

  // CRITICAL FIX: Use validateLink to ensure all required properties are present
  // This ensures backward compatibility with both old and new link formats
  const validatedLink = validateLink(basicLink);

  editor.update(() => {
    // get the current selection
    const selection = $getSelection();
    const nodeSelection = $createNodeSelection();

    // Create the link node with the validated properties
    const linkNode = $createCustomLinkNode(url);
    const textNode = $createTextNode(text);

    linkNode.append(textNode);

    // Store the validated properties on the node for later use
    // This ensures the link will render correctly in view mode
    linkNode.__validatedProps = validatedLink;

    if ($isRangeSelection(selection)) {
      selection.insertNodes([linkNode]);
    } else {
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
