/**
 * @jest-environment jsdom
 */

import { createEditor, Descendant, Transforms, Editor, Range } from 'slate';
import { withReact, ReactEditor } from 'slate-react';
import { withHistory } from 'slate-history';

// Mock the SlateEditor component's withLinkDeletion plugin
const withLinkDeletion = (editor: ReactEditor) => {
  const { deleteBackward, deleteForward } = editor;

  editor.deleteBackward = (unit) => {
    const { selection } = editor;

    if (selection && Range.isCollapsed(selection)) {
      // FIXED: Only delete link if cursor is IMMEDIATELY after it (offset 0 in next text node)
      try {
        const [parentNode, parentPath] = Editor.parent(editor, selection);
        if (parentNode && typeof parentNode === 'object' && 'type' in parentNode && parentNode.type === 'paragraph') {
          const currentIndex = selection.anchor.path[selection.anchor.path.length - 1];
          const currentOffset = selection.anchor.offset;

          // Only proceed if we're at the very beginning of a text node (offset 0)
          if (currentOffset === 0 && currentIndex > 0) {
            const prevSiblingPath = [...parentPath, currentIndex - 1];
            const [prevSibling] = Editor.node(editor, prevSiblingPath);

            if (prevSibling && typeof prevSibling === 'object' && 'type' in prevSibling && prevSibling.type === 'link') {
              // We're at the very beginning of text immediately after a link
              Transforms.removeNodes(editor, { at: prevSiblingPath });
              return;
            }
          }
        }
      } catch (e) {
        // Continue with normal deletion if path operations fail
      }
    }

    deleteBackward(unit);
  };

  editor.deleteForward = (unit) => {
    const { selection } = editor;

    if (selection && Range.isCollapsed(selection)) {
      // FIXED: Only delete link if cursor is IMMEDIATELY before it (at end of previous text node)
      try {
        const [parentNode, parentPath] = Editor.parent(editor, selection);
        if (parentNode && typeof parentNode === 'object' && 'type' in parentNode && parentNode.type === 'paragraph') {
          const currentIndex = selection.anchor.path[selection.anchor.path.length - 1];

          // Check if we're at the end of a text node and there's a next sibling that's a link
          const currentNode = Editor.node(editor, selection.anchor.path)[0];
          if (currentNode && typeof currentNode === 'object' && 'text' in currentNode) {
            const textLength = currentNode.text.length;

            // Only proceed if we're at the very end of the current text node
            if (selection.anchor.offset === textLength) {
              const nextSiblingPath = [...parentPath, currentIndex + 1];
              try {
                const [nextSibling] = Editor.node(editor, nextSiblingPath);

                if (nextSibling && typeof nextSibling === 'object' && 'type' in nextSibling && nextSibling.type === 'link') {
                  // We're at the very end of text immediately before a link
                  Transforms.removeNodes(editor, { at: nextSiblingPath });
                  return;
                }
              } catch (e) {
                // Next sibling doesn't exist, continue with normal deletion
              }
            }
          }
        }
      } catch (e) {
        // Continue with normal deletion if path operations fail
      }
    }

    deleteForward(unit);
  };

  return editor;
};

const createTestEditor = () => {
  return withLinkDeletion(withHistory(withReact(createEditor())));
};

describe('SlateEditor Link Deletion', () => {
  let editor: ReactEditor;

  beforeEach(() => {
    editor = createTestEditor();
    
    // Override isInline to treat link elements as inline
    const { isInline } = editor;
    editor.isInline = (element) => {
      return element.type === 'link' ? true : isInline(element);
    };

    // Override isVoid - links are not void, they contain text
    const { isVoid } = editor;
    editor.isVoid = (element) => {
      return element.type === 'link' ? false : isVoid(element);
    };
  });

  test('should delete entire link when backspace is pressed after a link', () => {
    // Set up editor with content: "Hello [link] world"
    const initialValue: Descendant[] = [
      {
        type: 'paragraph',
        children: [
          { text: 'Hello ' },
          {
            type: 'link',
            url: '/test-page',
            pageId: 'test-page',
            pageTitle: 'Test Page',
            isExternal: false,
            isPublic: true,
            isOwned: false,
            children: [{ text: 'link' }]
          },
          { text: ' world' }
        ]
      }
    ];

    editor.children = initialValue;

    // Position cursor right after the link (at the start of " world")
    Transforms.select(editor, {
      anchor: { path: [0, 2], offset: 0 },
      focus: { path: [0, 2], offset: 0 }
    });

    // Simulate backspace
    editor.deleteBackward('character');

    // Check that the link was deleted entirely and text nodes were merged
    const expectedValue: Descendant[] = [
      {
        type: 'paragraph',
        children: [
          { text: 'Hello  world' } // Slate merges adjacent text nodes
        ]
      }
    ];

    expect(editor.children).toEqual(expectedValue);
  });

  test('should delete entire link when delete is pressed before a link', () => {
    // Set up editor with content: "Hello [link] world"
    const initialValue: Descendant[] = [
      {
        type: 'paragraph',
        children: [
          { text: 'Hello ' },
          {
            type: 'link',
            url: '/test-page',
            pageId: 'test-page',
            pageTitle: 'Test Page',
            isExternal: false,
            isPublic: true,
            isOwned: false,
            children: [{ text: 'link' }]
          },
          { text: ' world' }
        ]
      }
    ];

    editor.children = initialValue;

    // Position cursor right before the link (at the end of "Hello ")
    Transforms.select(editor, {
      anchor: { path: [0, 0], offset: 6 },
      focus: { path: [0, 0], offset: 6 }
    });

    // Simulate delete key
    editor.deleteForward('character');

    // Check that the link was deleted entirely and text nodes were merged
    const expectedValue: Descendant[] = [
      {
        type: 'paragraph',
        children: [
          { text: 'Hello  world' } // Slate merges adjacent text nodes
        ]
      }
    ];

    expect(editor.children).toEqual(expectedValue);
  });

  test('should not affect normal character deletion', () => {
    // Set up editor with content: "Hello world"
    const initialValue: Descendant[] = [
      {
        type: 'paragraph',
        children: [
          { text: 'Hello world' }
        ]
      }
    ];

    editor.children = initialValue;

    // Position cursor after "Hello "
    Transforms.select(editor, {
      anchor: { path: [0, 0], offset: 6 },
      focus: { path: [0, 0], offset: 6 }
    });

    // Simulate backspace (should delete the space)
    editor.deleteBackward('character');

    // Check that only one character was deleted
    const expectedValue: Descendant[] = [
      {
        type: 'paragraph',
        children: [
          { text: 'Helloworld' }
        ]
      }
    ];

    expect(editor.children).toEqual(expectedValue);
  });

  test('should NOT delete link when cursor is in middle of text after link (bug fix)', () => {
    // This test covers the original bug: backspace anywhere in the line would delete ALL links
    // Set up editor with content: "Hello [link] world text"
    const initialValue: Descendant[] = [
      {
        type: 'paragraph',
        children: [
          { text: 'Hello ' },
          {
            type: 'link',
            url: '/test-page',
            pageId: 'test-page',
            pageTitle: 'Test Page',
            isExternal: false,
            isPublic: true,
            isOwned: false,
            children: [{ text: 'link' }]
          },
          { text: ' world text' }
        ]
      }
    ];

    editor.children = initialValue;

    // Position cursor in the MIDDLE of " world text" (not at the beginning)
    // This should NOT delete the link
    Transforms.select(editor, {
      anchor: { path: [0, 2], offset: 7 }, // After "world" in " world text"
      focus: { path: [0, 2], offset: 7 }
    });

    // Simulate backspace - should only delete the space before "text"
    editor.deleteBackward('character');

    // Check that the link is still there and only one character was deleted
    const expectedValue: Descendant[] = [
      {
        type: 'paragraph',
        children: [
          { text: 'Hello ' },
          {
            type: 'link',
            url: '/test-page',
            pageId: 'test-page',
            pageTitle: 'Test Page',
            isExternal: false,
            isPublic: true,
            isOwned: false,
            children: [{ text: 'link' }]
          },
          { text: ' worldtext' } // Only the space before "text" was deleted
        ]
      }
    ];

    expect(editor.children).toEqual(expectedValue);
  });
});
