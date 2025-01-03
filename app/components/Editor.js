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
import { LinkNode } from "@lexical/link";
import { CustomLinkNode, $createCustomLinkNode } from "./CustomLinkNode";
import { CustomLinkPlugin, INSERT_CUSTOM_LINK_COMMAND, insertCustomLink } from "./CustomLinkPlugin";
import BracketTriggerPlugin, { BracketNode, $createBracketNode } from "./BracketTriggerPlugin";
import { LinkDropdownPlugin } from "./LinkDropdownPlugin";

const theme = {
};

function onError(error) {
  console.error(error);
}

function Editor({ initialEditorState, setEditorState }) {
  const initialConfig = {
    namespace: "MyEditor",
    theme,
    onError,
    nodes: [BracketNode, CustomLinkNode, LinkNode],
  };

  function onChange(editorState) {
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
      <LinkDropdownPlugin />
    </LexicalComposer>
    </>
  );
}

function MyOnChangePlugin({ onChange, initialEditorState }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (initialEditorState) {
      editor.update(() => {
        const state = editor.parseEditorState(initialEditorState);
        editor.setEditorState(state);
      });
    }
  }, [editor]);

  useEffect(() => {
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      onChange(editorState);
    });

    return () => {
      unregister();
    };
  }, [editor, onChange]);

  return null;
}

export default Editor;
