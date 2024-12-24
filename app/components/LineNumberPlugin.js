import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { $getRoot } from "lexical";

export function LineNumberPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        const children = root.getChildren();
        const editorElement = editor.getRootElement();

        if (!editorElement) return;

        // Remove existing line numbers
        const existingLineNumbers = editorElement.querySelectorAll('.editor-line-number');
        existingLineNumbers.forEach(num => num.remove());

        // Create or update gutter container
        let gutter = editorElement.querySelector('.editor-gutter');
        if (!gutter) {
          gutter = document.createElement('div');
          gutter.className = 'editor-gutter absolute left-0 top-0 bottom-0 w-10 flex flex-col bg-gray-50 border-r border-gray-200';
          editorElement.parentElement.insertBefore(gutter, editorElement);
        }

        // Clear existing line numbers
        gutter.innerHTML = '';

        // Add new line numbers
        children.forEach((_, index) => {
          const lineNumber = document.createElement('div');
          lineNumber.className = 'editor-line-number text-xs text-gray-500 text-center py-1.5 select-none font-mono';
          lineNumber.textContent = index + 1;
          gutter.appendChild(lineNumber);
        });

        // Ensure line numbers align with text
        const textLines = editorElement.querySelectorAll('p');
        textLines.forEach((line, index) => {
          const lineNumber = gutter.children[index];
          if (lineNumber) {
            lineNumber.style.height = `${line.offsetHeight}px`;
          }
        });
      });
    });
  }, [editor]);

  return null;
}
