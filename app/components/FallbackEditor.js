"use client";

import { useState, useRef, forwardRef, useImperativeHandle } from 'react';

/**
 * FallbackEditor - A simple textarea-based editor that can be used when Slate.js fails
 * This provides basic editing functionality without any of the complex DOM manipulation
 */
const FallbackEditor = forwardRef(({ initialContent, onChange, placeholder, ...props }, ref) => {
  // Convert Slate content to plain text
  const slateToText = (content) => {
    if (!content || !Array.isArray(content)) return '';
    
    return content.map(node => {
      if (node.children) {
        return node.children.map(child => child.text || '').join('');
      }
      return node.text || '';
    }).join('\n');
  };

  // Convert plain text to Slate content
  const textToSlate = (text) => {
    if (!text) return [{ type: 'paragraph', children: [{ text: '' }] }];
    
    const lines = text.split('\n');
    return lines.map(line => ({
      type: 'paragraph',
      children: [{ text: line }]
    }));
  };

  const [value, setValue] = useState(() => slateToText(initialContent));
  const textareaRef = useRef(null);

  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    },
    getValue: () => textToSlate(value),
    setValue: (newValue) => setValue(slateToText(newValue))
  }));

  const handleChange = (e) => {
    const newValue = e.target.value;
    setValue(newValue);
    
    if (onChange) {
      // Convert back to Slate format for compatibility
      const slateContent = textToSlate(newValue);
      onChange(slateContent);
    }
  };

  const handleKeyDown = (e) => {
    // Handle basic keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 's':
          e.preventDefault();
          // Trigger save event
          document.dispatchEvent(new CustomEvent('editor-save-requested'));
          break;
        default:
          break;
      }
    }
  };

  return (
    <div className="fallback-editor w-full">
      <div className="mb-2 text-sm text-muted-foreground bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800">
        ⚠️ Using simplified editor mode. Some advanced features may not be available.
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full min-h-[300px] p-4 border border-input rounded-lg bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        style={{
          fontFamily: 'inherit',
          fontSize: '16px',
          lineHeight: '1.6'
        }}
        {...props}
      />
    </div>
  );
});

FallbackEditor.displayName = 'FallbackEditor';

export default FallbackEditor;
