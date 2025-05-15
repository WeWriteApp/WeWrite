"use client";

import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect, useCallback } from "react";
import {
  createEditor,
  Transforms,
  Editor,
  Element as SlateElement,
  Range,
  Node,
  Path,
} from "slate";
import { Editable, withReact, useSlate, Slate } from "slate-react";
import { ReactEditor } from "slate-react";
import { withHistory } from "slate-history";
import { Link as LinkIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { useLineSettings, LineSettingsProvider } from '../contexts/LineSettingsContext';

// Safely check if ReactEditor methods exist before using them
const safeReactEditor = {
  focus: (editor) => {
    try {
      if (ReactEditor && typeof ReactEditor.focus === 'function') {
        ReactEditor.focus(editor);
        return true;
      }
    } catch (error) {
      console.error('Error in safeReactEditor.focus:', error);
    }
    return false;
  },
  toDOMRange: (editor, selection) => {
    try {
      if (ReactEditor && typeof ReactEditor.toDOMRange === 'function') {
        return ReactEditor.toDOMRange(editor, selection);
      }
    } catch (error) {
      console.error('Error in safeReactEditor.toDOMRange:', error);
    }
    return null;
  },
  isFocused: (editor) => {
    try {
      if (ReactEditor && typeof ReactEditor.isFocused === 'function') {
        return ReactEditor.isFocused(editor);
      }
    } catch (error) {
      console.error('Error in safeReactEditor.isFocused:', error);
    }
    return false;
  },
  findPath: (editor, node) => {
    try {
      if (ReactEditor && typeof ReactEditor.findPath === 'function') {
        return ReactEditor.findPath(editor, node);
      }
    } catch (error) {
      console.error('Error in safeReactEditor.findPath:', error);
    }
    return [0];
  }
};

// Define the UnifiedEditor component
const UnifiedEditor = ({ /* props */ }) => {
  // Editor creation and configuration
  const editor = React.useMemo(() => {
    const editor = withHistory(withReact(createEditor()));
    
    // Store the original insertData function
    const { insertData } = editor;
    
    // Override insertData to handle pasted content
    editor.insertData = (data) => {
      try {
        // Call the original insertData function
        insertData(data);
      } catch (error) {
        console.error('Error in insertData:', error);
        // Fallback to original behavior
        insertData(data);
      }
    };
    
    return editor;
  }, []);
  
  return editor;
};

export default UnifiedEditor;
