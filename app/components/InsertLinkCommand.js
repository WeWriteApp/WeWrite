import { $createLinkNode } from '@lexical/react/LexicalLinkPlugin';
import { $getSelection, $isRangeSelection, $createTextNode } from 'lexical';
import { validateLink } from '../utils/linkValidator';

const INSERT_LINK_COMMAND = 'INSERT_LINK_COMMAND';

function insertLink(editor, url, text) {
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
    const selection = $getSelection();

    if ($isRangeSelection(selection)) {
      // Create the link node
      const linkNode = $createLinkNode(url);

      // Add the text node
      linkNode.append($createTextNode(text));

      // Store validated properties on the node
      // This is a workaround since we can't directly modify the node's properties
      // but we can add custom attributes that will be serialized
      Object.entries(validatedLink).forEach(([key, value]) => {
        if (key !== 'children' && key !== 'type' && key !== 'url') {
          linkNode.setTextContent(key, JSON.stringify(value));
        }
      });

      // Insert the node
      selection.insertNodes([linkNode]);
    }
  });
}

export { INSERT_LINK_COMMAND, insertLink };
