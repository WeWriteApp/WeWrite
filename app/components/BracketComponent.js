"use client";
import { useRef, useEffect, useState, useCallback, useContext } from "react";
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createTextNode } from 'lexical';
import { useAuth } from '../providers/AuthProvider';
import { DataContext } from '../providers/DataProvider';
import { $createCustomLinkNode } from './CustomLinkNode';

function BracketComponent({ node }) {
  const [isClient, setIsClient] = useState(false);
  const [editor] = useLexicalComposerContext();
  const { user } = useAuth();
  const { pages } = useContext(DataContext);
  const containerRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Set isClient on mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize node state
  useEffect(() => {
    if (!isClient || !node) return;

    editor.update(() => {
      if (typeof node.getShowDropdown === 'function') {
        setShowDropdown(node.getShowDropdown());
      }
    });
  }, [node, editor, isClient]);

  // Handle click outside
  useEffect(() => {
    if (!isClient) return;

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        editor.update(() => {
          setShowDropdown(false);
          if (node && typeof node.setShowDropdown === 'function') {
            node.setShowDropdown(false);
          }
        });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [containerRef, node, editor, isClient]);

  const handlePageSelect = useCallback((page) => {
    if (!node || !editor) {
      console.warn('BracketComponent: Missing node or editor');
      return;
    }

    editor.update(() => {
      const linkNode = $createCustomLinkNode(`/pages/${page.id}`);
      linkNode.append($createTextNode(page.title));
      node.replace(linkNode);
    });
  }, [node, editor]);

  const filteredPages = pages.filter(page =>
    page && page.title &&
    page.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (page.isPublic || (user && (page.userId === user.uid || (user.groups && user.groups.includes(page.groupId)))))
  );

  if (!isClient) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <span className="text-blue-500">[[</span>
      {showDropdown && (
        <div className="absolute z-10 mt-1 w-60 rounded-md bg-white shadow-lg">
          <input
            type="text"
            className="w-full p-2 border-b"
            placeholder="Search pages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <ul className="max-h-60 overflow-auto">
            {filteredPages.map((page) => (
              <li
                key={page.id}
                className="p-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => handlePageSelect(page)}
              >
                {page.title}
              </li>
            ))}
          </ul>
        </div>
      )}
      <span className="text-blue-500">]]</span>
    </div>
  );
}

export default BracketComponent;
