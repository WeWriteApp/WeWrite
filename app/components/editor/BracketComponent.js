"use client";
import { useContext, useState, useEffect, useRef, useCallback } from "react";
import { AuthContext } from "../../providers/AuthProvider";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { INSERT_CUSTOM_LINK_COMMAND } from "./CustomLinkPlugin";
import { useParams } from "next/navigation";

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
  const params = useParams();
  const currentPageId = params?.id;

  const fetchResults = useCallback(
    debounce(async (search) => {
      if (!user) return;

      console.log('BracketComponent - Fetching results for:', {
        search,
        userId: user.uid,
        groups: user.groups
      });

      setIsSearching(true);
      try {
        let groupIds = [];
        if (user.groups) {
          groupIds = Object.keys(user.groups);
        }

        const response = await fetch(
          `/api/search?userId=${user.uid}&searchTerm=${encodeURIComponent(search)}&groupIds=${groupIds}`
        );

        if (!response.ok) {
          console.error('Search API returned error:', response.status);
          const errorText = await response.text();
          console.error('Error details:', errorText);
          throw new Error(`Search API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('BracketComponent search response:', data);

        // Combine all pages into one array
        const combinedPages = [
          ...(data.userPages || []),
          ...(data.groupPages || []),
          ...(data.publicPages || [])
        ];

        // Filter out the current page to prevent self-referential links
        const filteredPages = combinedPages.filter(page => page.id !== currentPageId);

        console.log('BracketComponent processed results:', {
          total: combinedPages.length,
          filtered: filteredPages.length,
          currentPageId,
          bySection: {
            userPages: data.userPages?.length || 0,
            groupPages: data.groupPages?.length || 0,
            publicPages: data.publicPages?.length || 0
          }
        });

        setAllPages(filteredPages);
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
    const value = event.target.value;
    console.log('BracketComponent input change:', {
      value,
      length: value?.length,
      trimmed: value?.trim()?.length
    });
    setInputValue(value);
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
    <div ref={containerRef} className="relative bg-card shadow-md rounded-md p-4 w-64 border border-border">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder="Search for a page..."
        className="w-full p-2 border border-input rounded-md bg-background text-foreground"
        autoComplete="off"
      />
      {isSearching ? (
        <div className="mt-2 text-center text-muted-foreground flex justify-center"><div className="loader"></div></div>
      ) : (
        allPages.length > 0 && (
          <ul className="mt-2 max-h-40 overflow-y-auto border border-border rounded-md bg-card">
            {allPages.map((page) => (
              <li
                key={page.id}
                className="p-2 hover:bg-muted cursor-pointer text-foreground"
                onClick={() => handlePageClick(page)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{page.title}</span>
                  {page.username !== 'NULL' && page.userId !== user.uid && (
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      by {page.username}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

export default BracketComponent;
