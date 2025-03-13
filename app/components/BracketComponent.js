"use client";
import { useContext, useState, useEffect, useRef, useCallback } from "react";
import { AuthContext } from "../providers/AuthProvider";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { INSERT_CUSTOM_LINK_COMMAND } from "./CustomLinkPlugin";

function debounce(func, delay) {
  let timeout;
  return (...args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

function BracketComponent() {
  const [inputValue, setInputValue] = useState("");
  const [allPages, setAllPages] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef(null);
  const [editor] = useLexicalComposerContext();
  const { user } = useContext(AuthContext);

  const fetchResults = useCallback(
    debounce(async (search) => {
      if (!user) return;

      console.log('BracketComponent searching for:', search);
      setIsSearching(true);
      try {
        let groupIds = [];
        if (user.groups) {
          groupIds = Object.keys(user.groups);
        }

        const response = await fetch(
          `/api/search?userId=${user.uid}&searchTerm=${encodeURIComponent(search)}&groupIds=${groupIds}`
        );
        const data = await response.json();
        console.log('BracketComponent search results:', data);
        
        // Combine all pages into one array
        const combinedPages = [
          ...(data.userPages || []),
          ...(data.groupPages || []),
          ...(data.publicPages || [])
        ];

        console.log('BracketComponent combined pages:', combinedPages);
        setAllPages(combinedPages);
      } catch (error) {
        console.error("Error fetching search results", error);
        setAllPages([]);
      } finally {
        setIsSearching(false);
      }
    }, 500),
    [user]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        containerRef.current.style.display = 'none';
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [containerRef]);

  useEffect(() => {
    if (!inputValue) {
      setAllPages([]);
      return;
    }

    fetchResults(inputValue);
  }, [inputValue, fetchResults]);

  const handleInputChange = (event) => {
    setInputValue(event.target.value);
  };

  const handlePageClick = (page) => {
    const url = `/pages/${page.id}`;
    const text = page.title;

    if (!url || !text) {
      console.error('URL or text is undefined');
      return;
    }

    editor.dispatchCommand(INSERT_CUSTOM_LINK_COMMAND, { url, text });

    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.style.display = 'none';
      }
    }, 0);
  };

  return (
    <div ref={containerRef} className="relative bg-white shadow-md rounded-md p-4 w-64">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder="Search for a page..."
        className="w-full p-2 border border-gray-300 rounded-md"
        autoComplete="off"
      />
      {isSearching ? (
        <div className="mt-2 text-center text-gray-500">Loading...</div>
      ) : (
        allPages.length > 0 && (
          <ul className="mt-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md">
            {allPages.map((page) => (
              <li
                key={page.id}
                className="p-2 hover:bg-gray-200 cursor-pointer flex items-center justify-between"
                onClick={() => handlePageClick(page)}
              >
                <span>{page.title}</span>
                {page.isPublic && page.userId !== user.uid && (
                  <span className="text-xs text-gray-500">by {page.userId}</span>
                )}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

export default BracketComponent;
