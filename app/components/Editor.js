"use client";
import { $getRoot, $getSelection, COMMAND_PRIORITY_EDITOR } from "lexical";
import { useEffect, useState } from "react";

import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { CustomLinkNode, $createCustomLinkNode } from "./CustomLinkNode";
import { CustomLinkPlugin, INSERT_CUSTOM_LINK_COMMAND, insertCustomLink } from "./CustomLinkPlugin";
import { BracketNode, BracketTriggerPlugin } from "./BracketTriggerPlugin";
import { toast } from "./ui/use-toast";
const theme = {
};

function onError(error) {
  console.error(error);
}

// Plugin to limit consecutive newlines
function NewlineRestrictionPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Register a listener for keydown events
    const removeListener = editor.registerCommand(
      'keydown',
      (event) => {
        // Check if the key pressed is Enter
        if (event.key === 'Enter') {
          // Get the editor state
          let hasConsecutiveNewlines = false;

          editor.getEditorState().read(() => {
            const selection = $getSelection();
            if (selection) {
              const textContent = $getRoot().getTextContent();
              const currentPosition = selection.anchor.offset;

              // Check if there's already a newline at the current position
              if (textContent[currentPosition - 1] === '\n' && textContent[currentPosition] === '\n') {
                hasConsecutiveNewlines = true;
              }
            }
          });

          if (hasConsecutiveNewlines) {
            // Prevent the default behavior (adding another newline)
            event.preventDefault();

            // Show a toast notification
            toast({
              title: "Newline limit reached",
              description: "You can only use one newline at a time. Read more about paragraph formatting.",
              action: (
                <a
                  href="/pages/LAN5SCiBX67EGALQGe28"
                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  Read more
                </a>
              ),
            });

            return true;
          }
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR
    );

    return () => {
      removeListener();
    };
  }, [editor]);

  return null;
}

function Editor({ initialEditorState, setEditorState }) {
  const initialConfig = {
    namespace: "MyEditor",
    theme,
    onError,
    nodes: [BracketNode,CustomLinkNode], // Registering the custom node and LinkNode
  };

  function onChange(editorState) {
    // read the editor state and console log the JSON
    editorState.read(async () => {
      console.log(editorState.toJSON());
    });

    setEditorState(editorState);
  }

  return (
    <>
    <LexicalComposer initialConfig={initialConfig}>
      <PlainTextPlugin
        contentEditable={<ContentEditable />}
        placeholder={<></>}
        ErrorBoundary={LexicalErrorBoundary}

      />
      <HistoryPlugin />
      <AutoFocusPlugin />
      <CustomLinkPlugin />
      <MyOnChangePlugin onChange={onChange} initialEditorState={initialEditorState} />
      <BracketTriggerPlugin />
      <NewlineRestrictionPlugin />
    </LexicalComposer>

    </>
  );
}

function MyOnChangePlugin({ onChange, initialEditorState }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Load initial editor state
    if (initialEditorState) {
      editor.update(() => {
        const state = editor.parseEditorState(initialEditorState);
        editor.setEditorState(state);
      });
    }

  }, [editor]);

  useEffect(() => {
    // Register change listener
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      onChange(editorState);
    });

    // Cleanup function to unregister listener and command
    return () => {
      unregister();
    };
  }, [editor, onChange]);

  return null;
}

export default Editor;
