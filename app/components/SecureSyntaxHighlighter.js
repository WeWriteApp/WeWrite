"use client";

import React from "react";
import Prism from "prismjs";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-python";
import "prismjs/themes/prism-tomorrow.css";

/**
 * A secure syntax highlighter component that uses the latest version of PrismJS directly
 * instead of using react-syntax-highlighter's outdated dependencies.
 * 
 * This component addresses the PrismJS DOM Clobbering vulnerability (GHSA-x7hr-w5r2-h6wg).
 */
const SecureSyntaxHighlighter = ({ 
  language = "javascript", 
  children, 
  customStyle = {} 
}) => {
  // Use a ref to store the pre element
  const preRef = React.useRef(null);

  // Highlight the code when the component mounts or updates
  React.useEffect(() => {
    if (preRef.current) {
      Prism.highlightElement(preRef.current);
    }
  }, [language, children]);

  // Default styling that matches the previous SyntaxHighlighter
  const defaultStyle = {
    borderRadius: '0.5rem',
    padding: '1rem',
    fontSize: '0.875rem',
    lineHeight: 1.7,
    backgroundColor: '#2d2d2d',
    color: '#ccc',
    overflow: 'auto',
    margin: '0',
  };

  // Combine default styles with custom styles
  const mergedStyle = { ...defaultStyle, ...customStyle };

  // Map from our language props to Prism's language classes
  const languageMap = {
    "js": "language-javascript",
    "javascript": "language-javascript",
    "jsx": "language-jsx",
    "ts": "language-typescript",
    "typescript": "language-typescript",
    "tsx": "language-tsx",
    "bash": "language-bash",
    "sh": "language-bash",
    "shell": "language-bash",
    "json": "language-json",
    "py": "language-python",
    "python": "language-python",
    "html": "language-html",
    "css": "language-css",
  };

  // Get the appropriate language class or fallback to text
  const languageClass = languageMap[language.toLowerCase()] || "language-text";

  return (
    <pre ref={preRef} style={mergedStyle} className={languageClass}>
      <code className={languageClass}>
        {children}
      </code>
    </pre>
  );
};

export default SecureSyntaxHighlighter;
