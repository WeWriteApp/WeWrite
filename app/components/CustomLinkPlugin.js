import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import { $getSelection, $isRangeSelection, $createTextNode, $getRoot, COMMAND_PRIORITY_EDITOR,$createParagraphNode, $createRangeSelection,$createNodeSelection, $setSelection

 } from 'lexical';
import { $createCustomLinkNode } from './CustomLinkNode';

const INSERT_CUSTOM_LINK_COMMAND = 'INSERT_CUSTOM_LINK_COMMAND';

function insertCustomLink(editor, url, text) {
  if (!url || !text) {
    console.error('URL or text is undefined');
    return;
  }

  editor.update(() => {
    // get the current selection
    const selection = $getSelection();
    const nodeSelection = $createNodeSelection();

    const linkNode = $createCustomLinkNode(url);
    const textNode = $createTextNode(text);

    linkNode.append(textNode);


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
