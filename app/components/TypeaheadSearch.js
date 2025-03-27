"use client";
import React, {
  useEffect,
  useState,
  useContext,
  useCallback,
  useRef,
} from "react";
import { AuthContext } from "../providers/AuthProvider";
import { MobileContext } from "../providers/MobileProvider";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PillLink } from "./PillLink";
import debounce from "lodash.debounce";
import { useTheme } from "next-themes";
import { Input } from "./ui/input";

// Define a simple Loader component directly in this file
const Loader = () => {
  return (
    <div className="flex justify-center items-center p-4">
      <div className="animate-spin h-5 w-5 border-2 border-gray-500 rounded-full border-t-transparent"></div>
    </div>
  );
};

const characterCount = 1;

const TypeaheadSearch = ({
  onSelect = null,
  setShowResults = null,
  userId = null,
  placeholder = "Search...",
  radioSelection = false,
  selectedId = null
}) => {
  const [search, setSearch] = useState("");
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  const [userPages, setUserPages] = useState([]);
  const [groupPages, setGroupPages] = useState([]);
  const [publicPages, setPublicPages] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const { theme } = useTheme();
  const router = useRouter();

  // Add error handling for missing auth context
  useEffect(() => {
    if (!authContext) {
      console.warn("AuthContext is not available in TypeaheadSearch");
    }
  }, [authContext]);

  const fetchResults = useCallback(
    debounce(async (search, user) => {
      if (!user && !userId) {
        console.log('TypeaheadSearch - No user or userId provided, skipping search');
        return;
      }

      console.log('TypeaheadSearch - Fetching results for:', {
        search,
        searchLength: search?.length,
        searchTrimmed: search?.trim(),
        searchTrimmedLength: search?.trim()?.length,
        userId: userId || user?.uid,
        groups: user?.groups,
        characterCount
      });

      setIsSearching(true);
      try {
        let selectedUserId = userId ? userId : user.uid;
        let groupIds = [];
        if (user && user.groups) {
          groupIds = Object.keys(user.groups);
        }

        const queryUrl = `/api/search?userId=${selectedUserId}&searchTerm=${encodeURIComponent(search)}&groupIds=${groupIds}`;
        console.log('Making API request to:', queryUrl);
        
        // Add timeout to prevent infinite loading
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout (increased from 10s)
        
        // Add more comprehensive error handling for fetch
        try {
          const response = await fetch(queryUrl, { 
            signal: controller.signal,
            cache: 'no-store' // Prevent caching of search results
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            console.error('TypeaheadSearch - API returned error:', response.status);
            const errorText = await response.text();
            console.error('Error details:', errorText);
            throw new Error(`Search API error: ${response.status}`);
          }

          const data = await response.json();
          console.log('TypeaheadSearch - API response:', data);
          
          // Check if we received an error message
          if (data.error) {
            console.error('TypeaheadSearch - API returned error object:', data.error);
          }
          
          // Continue with the arrays even if there's an error
          setUserPages(data.userPages || []);
          setGroupPages(data.groupPages || []);
          setPublicPages(data.publicPages || []);
        } catch (fetchError) {
          if (fetchError.name === 'AbortError') {
            console.error('Search request timed out after 15 seconds');
            throw new Error('Search request timed out');
          }
          console.error('Fetch error:', fetchError);
          throw fetchError;
        }
      } catch (error) {
        console.error("TypeaheadSearch - Error fetching search results", error);
        console.error("Error details:", error.message, error.stack);
        setUserPages([]);
        setGroupPages([]);
        setPublicPages([]);
      } finally {
        setIsSearching(false);
      }
    }, 500),
    [userId]
  );

  const resetSearchResults = () => {
    setUserPages([]);
    setGroupPages([]);
    setPublicPages([]);
    setIsSearching(false);
  };

  useEffect(() => {
    if (!search) {
      resetSearchResults();
      return;
    }
    if (!user) return;

    // if search less than minimum characters, don't make request
    if (search.length < characterCount || !search.trim()) {
      resetSearchResults();
      return;
    }

    fetchResults(search.trim(), user);
  }, [search, user, fetchResults]);

  useEffect(() => {
    if (onSelect) {
      // make the input active when the user starts typing
      const searchElement = document.getElementById("search-input");
      if (searchElement) {
        searchElement.focus();
      }
    }
  }, [onSelect]);

  const handleInputChange = (e) => {
    setSearch(e.target.value);
  };

  if (!user) return null;
  return (
    <div className="flex flex-col" id="typeahead-search">
      <div className="flex flex-col space-y-1">
        <div className="relative w-full">
          <Input
            id="search-input"
            type="text"
            placeholder={placeholder}
            value={search}
            onChange={handleInputChange}
            onFocus={() => setShowResults && setShowResults(true)}
            className="w-full pr-10"
            autoComplete="off"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            {isSearching ? (
              <Loader />
            ) : (
              <Search className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      <div
        className={`mt-2 space-y-1 transition-all ${
          search.length >= characterCount
            ? "opacity-100"
            : "opacity-0"
        }`}
      >
        {isSearching && search.length >= characterCount ? (
          <Loader />
        ) : (
          <>
            {userPages.length > 0 && (
              <div>
                {userPages.map((page) =>
                  onSelect ? (
                    <SingleItemButton
                      page={page}
                      search={search}
                      onSelect={onSelect}
                      radioSelection={radioSelection}
                      isSelected={selectedId === page.id}
                      key={page.id}
                    />
                  ) : (
                    <SingleItemLink
                      page={page}
                      search={search}
                      key={page.id}
                    />
                  )
                )}
              </div>
            )}

            {groupPages.length > 0 && (
              <div>
                {groupPages.map((page) =>
                  onSelect ? (
                    <SingleItemButton
                      page={page}
                      search={search}
                      onSelect={onSelect}
                      radioSelection={radioSelection}
                      isSelected={selectedId === page.id}
                      key={page.id}
                    />
                  ) : (
                    <SingleItemLink
                      page={page}
                      search={search}
                      key={page.id}
                    />
                  )
                )}
              </div>
            )}

            {publicPages.length > 0 && (
              <div>
                {publicPages.map((page) =>
                  onSelect ? (
                    <SingleItemButton
                      page={page}
                      search={search}
                      onSelect={onSelect}
                      radioSelection={radioSelection}
                      isSelected={selectedId === page.id}
                      key={page.id}
                    />
                  ) : (
                    <SingleItemLink
                      page={page}
                      search={search}
                      key={page.id}
                    />
                  )
                )}
              </div>
            )}

            {search.length >= 2 && userPages.length === 0 && groupPages.length === 0 && publicPages.length === 0 && (
              <div className="p-3">
                <button
                  onClick={() => {
                    // Indicate that we're creating a new page
                    setIsSearching(true);
                    
                    // Use the createPage function to actually create a page in Firebase
                    import('../firebase/database').then(async ({ createPage }) => {
                      try {
                        // Check if user exists before accessing uid
                        if (!user) {
                          console.error("User is not authenticated");
                          setIsSearching(false);
                          return;
                        }
                        
                        // Create a proper page with the search term as the title
                        const newPageData = {
                          title: search,
                          isPublic: true,
                          userId: user.uid,
                          content: JSON.stringify([
                            { type: "paragraph", children: [{ text: "" }] }
                          ])
                        };
                        
                        // Actually create the page in the database
                        const newPageId = await createPage(newPageData);
                        
                        if (newPageId) {
                          console.log("Created new page:", newPageId, "with title:", search);
                          
                          // Return the newly created page with proper ID and title
                          onSelect({ 
                            id: newPageId, 
                            title: search,
                            isPublic: true,
                            userId: user.uid,
                          });
                          
                          // Redirect to the edit view of the newly created page
                          router.push(`/pages/${newPageId}?edit=true`);
                        } else {
                          console.error("Failed to create new page");
                        }
                      } catch (error) {
                        console.error("Error creating new page:", error);
                      } finally {
                        setIsSearching(false);
                      }
                    });
                  }}
                  className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors text-center"
                >
                  Create new "{search}" page
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const SingleItemLink = ({ page, search }) => {
  return (
    <PillLink 
      href={`/pages/${page.id}`} 
      key={page.id}
      isPublic={page.isPublic}
    >
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="truncate">{highlightText(page.title, search)}</span>
        {page.username !== 'NULL' && page.isPublic && (
          <span className="text-xs opacity-75 whitespace-nowrap">
            by {page.username}
          </span>
        )}
      </div>
    </PillLink>
  );
};

const SingleItemButton = ({ page, search, onSelect, radioSelection = false, isSelected = false }) => {
  if (radioSelection) {
    return (
      <div 
        className="flex items-center space-x-2 p-2 rounded hover:bg-accent/50 cursor-pointer"
        onClick={() => onSelect(page)}
      >
        <input 
          type="radio" 
          id={`page-${page.id}`} 
          name="page" 
          className="h-4 w-4 text-primary border-muted-foreground"
          checked={isSelected}
          onChange={() => onSelect(page)}
        />
        <label htmlFor={`page-${page.id}`} className="text-sm cursor-pointer flex-1">
          {highlightText(page.title, search)}
        </label>
        {page.username !== 'NULL' && page.isPublic && (
          <span className="text-xs opacity-75 whitespace-nowrap">
            {page.groupId ? 'Group' : `by ${page.username}`}
          </span>
        )}
      </div>
    );
  }
  
  return (
    <button
      onClick={() => onSelect(page)}
      className="inline-flex mr-2 my-1 px-3 py-1.5 items-center gap-1 whitespace-nowrap text-sm font-medium rounded-[12px] bg-blue-100/50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-[1.5px] border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-300 dark:hover:border-blue-700 transition-colors w-full justify-between"
      key={page.id}
    >
      <span className="truncate">
        {highlightText(page.title, search)}
      </span>
      {page.username !== 'NULL' && page.isPublic && (
        <span className="text-xs opacity-75 whitespace-nowrap">
          {page.groupId ? 'Group' : `by ${page.username}`}
        </span>
      )}
    </button>
  );
};

const highlightText = (text, searchTerm) => {
  if (!searchTerm) return text;
  const parts = text.split(new RegExp(`(${searchTerm})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === searchTerm.toLowerCase() ? (
      <span key={index} className="text-primary">
        {part}
      </span>
    ) : (
      part
    )
  );
};

export default TypeaheadSearch;
