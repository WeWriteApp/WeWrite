"use client";

import React, { useState, useEffect } from 'react';
import SlateEditor from './SlateEditor';

/**
 * TestReplyEditor Component
 * 
 * A simplified test component that directly provides hardcoded content to the SlateEditor
 * to verify that it can properly display pre-filled content with links.
 */
export default function TestReplyEditor({ setEditorState }) {
  // Hardcoded test content with attribution and links
  const testContent = [
    {
      type: "paragraph",
      children: [
        { text: "Replying to " },
        {
          type: "link",
          url: "/test-page-id",
          children: [{ text: "Test Page Title" }]
        },
        { text: " by " },
        {
          type: "link",
          url: "/u/test-user-id",
          children: [{ text: "Test User" }]
        }
      ]
    },
    {
      type: "paragraph",
      children: [{ text: "" }]
    },
    {
      type: "paragraph",
      children: [{ text: "I'm responding to this page because..." }]
    },
    {
      type: "paragraph",
      children: [{ text: "" }]
    }
  ];

  // Log the content to help with debugging
  console.log("TestReplyEditor using hardcoded content:", JSON.stringify(testContent, null, 2));

  // Pass the content to the parent component
  useEffect(() => {
    if (setEditorState) {
      setEditorState(testContent);
    }
  }, [setEditorState]);

  // Custom onChange handler to prevent editing the attribution line
  const handleChange = (value) => {
    // Ensure the first two paragraphs remain unchanged
    if (value.length > 0) {
      // Keep the attribution line unchanged
      value[0] = testContent[0];
      
      // Keep the blank line unchanged
      if (value.length > 1) {
        value[1] = testContent[1];
      }
    }
    
    // Pass the updated value to the parent component
    if (setEditorState) {
      setEditorState(value);
    }
  };

  return (
    <SlateEditor
      initialContent={testContent}
      onContentChange={handleChange}
    />
  );
}
