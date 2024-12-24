import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { $getRoot, $createParagraphNode } from "lexical";

export function LineNumberPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Add line numbers when the editor updates
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        const children = root.getChildren();

        // Remove existing line numbers
        const existingLineNumbers = document.querySelectorAll('.line-number');
        existingLineNumbers.forEach(num => num.remove());

        // Add new line numbers
        children.forEach((node, index) => {
          if (node.getType() === 'paragraph') {
            const domElement = editor.getElementByKey(node.getKey());
            if (domElement) {
              const lineNumber = document.createElement('span');
              lineNumber.className = 'line-number border border-text rounded-full px-2 py-1 mr-2 bg-background text-text text-xs';
              lineNumber.textContent = index + 1;
              domElement.insertBefore(lineNumber, domElement.firstChild);
            }
          }
        });
      });
    });
  }, [editor]);

  return null;
}
