"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createLinkNode } from '@lexical/link';
import { $createTextNode } from 'lexical';
import { getPages } from '../firebase/database';
import { useAuth } from '../providers/AuthProvider';

function BracketComponent({ node }) {
  const [editor] = useLexicalComposerContext();
  const { user } = useAuth();
  const containerRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [pages, setPages] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (node && typeof node.__showDropdown !== 'undefined') {
      setShowDropdown(node.__showDropdown);
    }
  }, [node]);

  useEffect(() => {
    const fetchPages = async () => {
      if (showDropdown && user) {
        console.log('BracketComponent: Fetching pages for user:', user);
        const fetchedPages = await getPages();
        console.log('BracketComponent: Fetched pages:', fetchedPages);
        if (Array.isArray(fetchedPages)) {
          setPages(fetchedPages);
        }
      }
    };
    fetchPages();
  }, [showDropdown, user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
        node.__showDropdown = false;
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [containerRef, node]);

  const handlePageSelect = useCallback((page) => {
    editor.update(() => {
      const linkNode = $createLinkNode(`/pages/${page.id}`);
      linkNode.append($createTextNode(page.name));
      node.replace(linkNode);
    });
  }, [editor, node]);

  const filteredPages = pages.filter(page =>
    page && page.name && (
      !searchTerm ||
      page.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  if (!showDropdown) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <div className="absolute z-50 top-full left-0 mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-2 min-w-[200px]">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search for a page..."
          className="w-full p-2 border rounded mb-2 dark:bg-gray-700 dark:text-white"
        />
        <div className="max-h-40 overflow-y-auto">
          {filteredPages.length > 0 ? (
            filteredPages.map((page) => (
              <div
                key={page.id}
                onClick={() => handlePageSelect(page)}
                className="cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-white"
              >
                {page.name}
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                  {page.isPublic ? '(Public)' : '(Private)'}
                </span>
              </div>
            ))
          ) : (
            <div className="p-2 text-gray-500 dark:text-gray-400">No pages found</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BracketComponent;
