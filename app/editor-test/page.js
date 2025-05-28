"use client";
import React, { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '../components/ui/button';

// Import the unified editor dynamically to avoid SSR issues
const Editor = dynamic(() => import("../components/editor/Editor"), { ssr: false });

export default function EditorTestPage() {
  const [content, setContent] = useState('');
  const editorRef = useRef(null);

  const handleContentChange = (newContent) => {
    setContent(JSON.stringify(newContent, null, 2));
  };

  const focusEditor = () => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Editor Cursor Position Test</h1>

      <div className="space-y-6">
        <div className="border border-border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Editor</h2>
          <p className="text-muted-foreground mb-4">
            Test the cursor positioning by clicking in different parts of the editor and typing.
            The cursor should stay where you place it and not jump to line 2.
          </p>

          <div className="border border-border rounded-lg p-4 mb-4">
            <Editor
              ref={editorRef}
              initialContent={[
                {
                  type: 'paragraph',
                  children: [{ text: 'Line 1: Try editing this line' }]
                },
                {
                  type: 'paragraph',
                  children: [{ text: 'Line 2: Or this line' }]
                },
                {
                  type: 'paragraph',
                  children: [{ text: 'Line 3: Or even this line' }]
                }
              ]}
              onChange={handleContentChange}
              placeholder="Start typing..."
              contentType="wiki"
            />
          </div>

          <Button onClick={focusEditor}>
            Focus Editor
          </Button>
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <h3 className="text-sm font-medium mb-2">Current Content:</h3>
          <pre className="text-xs overflow-auto max-h-60 p-2 bg-background rounded border">
            {content || 'No content yet'}
          </pre>
        </div>
      </div>
    </div>
  );
}
