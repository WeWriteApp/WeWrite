"use client";
import React, { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

// Import the main editor dynamically to avoid SSR issues
const Editor = dynamic(() => import("../components/editor/Editor"), { ssr: false });

export default function TestEditorPage() {
  // State for each editor type
  const [wikiContent, setWikiContent] = useState('');
  const [aboutContent, setAboutContent] = useState('');
  const [bioContent, setBioContent] = useState('');

  // State for displaying content
  const [displayContent, setDisplayContent] = useState('');
  const [contentType, setContentType] = useState('');

  // Refs for editors
  const wikiEditorRef = useRef(null);
  const aboutEditorRef = useRef(null);
  const bioEditorRef = useRef(null);

  // Handle content changes for each editor
  const handleWikiContentChange = (content) => {
    setWikiContent(content);
  };

  const handleAboutContentChange = (content) => {
    setAboutContent(content);
  };

  const handleBioContentChange = (content) => {
    setBioContent(content);
  };

  // Copy content to clipboard
  const copyContent = (content, type) => {
    navigator.clipboard.writeText(content);
    setDisplayContent(content);
    setContentType(type);
  };

  // Test pasting content
  const testPaste = (editorRef) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Editor Standardization Test</h1>

      <Tabs defaultValue="wiki">
        <TabsList className="mb-4">
          <TabsTrigger value="wiki">Wiki Page Editor</TabsTrigger>
          <TabsTrigger value="about">Group About Editor</TabsTrigger>
          <TabsTrigger value="bio">User Bio Editor</TabsTrigger>
          <TabsTrigger value="clipboard">Clipboard Content</TabsTrigger>
        </TabsList>

        <TabsContent value="wiki" className="space-y-4">
          <h2 className="text-xl font-semibold">Wiki Page Editor</h2>
          <div className="border border-border rounded-lg p-4">
            <Editor
              ref={wikiEditorRef}
              initialContent=""
              onChange={handleWikiContentChange}
              placeholder="Start typing in the wiki page editor..."
              contentType="wiki"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => copyContent(wikiContent, 'wiki')}>
              Copy Wiki Content
            </Button>
            <Button onClick={() => testPaste(wikiEditorRef)} variant="outline">
              Focus (for paste test)
            </Button>
          </div>
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="text-sm font-medium mb-2">Current Content:</h3>
            <pre className="text-xs overflow-auto max-h-40 p-2 bg-background rounded border">
              {wikiContent}
            </pre>
          </div>
        </TabsContent>

        <TabsContent value="about" className="space-y-4">
          <h2 className="text-xl font-semibold">Group About Editor</h2>
          <div className="border border-border rounded-lg p-4">
            <Editor
              ref={aboutEditorRef}
              initialContent=""
              onChange={handleAboutContentChange}
              placeholder="Start typing in the group about editor..."
              contentType="about"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => copyContent(aboutContent, 'about')}>
              Copy About Content
            </Button>
            <Button onClick={() => testPaste(aboutEditorRef)} variant="outline">
              Focus (for paste test)
            </Button>
          </div>
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="text-sm font-medium mb-2">Current Content:</h3>
            <pre className="text-xs overflow-auto max-h-40 p-2 bg-background rounded border">
              {aboutContent}
            </pre>
          </div>
        </TabsContent>

        <TabsContent value="bio" className="space-y-4">
          <h2 className="text-xl font-semibold">User Bio Editor</h2>
          <div className="border border-border rounded-lg p-4">
            <Editor
              ref={bioEditorRef}
              initialContent=""
              onChange={handleBioContentChange}
              placeholder="Start typing in the user bio editor..."
              contentType="bio"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => copyContent(bioContent, 'bio')}>
              Copy Bio Content
            </Button>
            <Button onClick={() => testPaste(bioEditorRef)} variant="outline">
              Focus (for paste test)
            </Button>
          </div>
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="text-sm font-medium mb-2">Current Content:</h3>
            <pre className="text-xs overflow-auto max-h-40 p-2 bg-background rounded border">
              {bioContent}
            </pre>
          </div>
        </TabsContent>

        <TabsContent value="clipboard" className="space-y-4">
          <h2 className="text-xl font-semibold">Clipboard Content</h2>
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="text-sm font-medium mb-2">Content Type: {contentType}</h3>
            <pre className="text-xs overflow-auto max-h-80 p-2 bg-background rounded border">
              {displayContent}
            </pre>
          </div>
          <p className="text-sm text-muted-foreground">
            Copy content from one editor tab, then go to another editor tab, focus it, and paste the content to test cross-editor compatibility.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
