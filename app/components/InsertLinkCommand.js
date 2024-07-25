import { $createLinkNode } from '@lexical/react/LexicalLinkPlugin';
import { $getSelection, $isRangeSelection, $createTextNode } from 'lexical';

const INSERT_LINK_COMMAND = 'INSERT_LINK_COMMAND';

function insertLink(editor, url, text) {
  if (!url || !text) {
    console.error('URL or text is undefined');
    return;
  }

  editor.update(() => {
    const selection = $getSelection();

    if ($isRangeSelection(selection)) {
      const linkNode = $createLinkNode(url);
      linkNode.append($createTextNode(text)); // Create a text node for the link text
      selection.insertNodes([linkNode]);
    }
  });
}

export { INSERT_LINK_COMMAND, insertLink };
