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
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PillLink } from "./PillLink";
import debounce from "lodash.debounce";
import { useTheme } from "next-themes";
import { Input } from "./ui/input";
import { getDatabase, ref, onValue } from "firebase/database";
import { app } from "../firebase/config";

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
  placeholder = "Link to page...",
  initialSelectedId = null,
  editableOnly = false, // New prop to filter for editable pages only
  initialSearch = "", // New prop to set initial search value
  displayText = "", // Display text for the link
  setDisplayText = null, // Function to update display text
  onInputChange = null, // Function to handle input changes
  preventRedirect = false, // Prevent redirect to search page
  searchPageMode = false, // New prop for search page mode
  onSearchPageSelect = null, // Callback for search page selections
  className = "", // Additional CSS classes
  showClearButton = false // Show clear button for search page mode
}) => {
  const [search, setSearch] = useState(initialSearch);
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  const [pages, setPages] = useState({
    userPages: [],
    groupPages: [],
    publicPages: [],
    users: []
  });
  const [isSearching, setIsSearching] = useState(false);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const { theme } = useTheme();
  const router = useRouter();

  // Cache for user profiles
  const [userProfiles, setUserProfiles] = useState({});

  // Fetch user profile for a given userId
  const fetchUserProfile = async (userId) => {
    if (!userId) return null;

    // Return from cache if available
    if (userProfiles[userId]) {
      return userProfiles[userId];
    }

    try {
      // Get users from the realtime database
      const db = getDatabase(app);
      const userRef = ref(db, `users/${userId}`);

      return new Promise((resolve) => {
        onValue(userRef, (snapshot) => {
          const userData = snapshot.val();
          if (userData) {
            // Update cache
            setUserProfiles(prev => ({...prev, [userId]: userData}));
            resolve(userData);
          } else {
            resolve(null);
          }
        }, {
          onlyOnce: true
        });
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  // Process the fetched pages to include proper usernames
  const processPagesWithUsernames = async (pages) => {
    if (!pages || pages.length === 0) return pages;

    try {
      // Import the getUsernameById function
      const { getUsernameById } = await import('../utils/userUtils');

      // Process pages in parallel with Promise.all for better performance
      return await Promise.all(pages.map(async (page) => {
        // For user's own pages, ensure we have the userId
        if (!page.userId && page.isOwned && user) {
          page.userId = user.uid;
        }

        // If we have a userId, get the username using our utility function
        let username = page.username || 'Anonymous';
        if (page.userId) {
          try {
            username = await getUsernameById(page.userId);
          } catch (usernameError) {
            console.error(`Error getting username for user ${page.userId}:`, usernameError);
          }
        }

        return {
          ...page,
          userId: page.userId || (user ? user.uid : null),
          username: username
        };
      }));
    } catch (error) {
      console.error("Error processing page usernames:", error);

      // Fall back to returning the original pages if there was an error
      return pages.map(page => ({
        ...page,
        username: page.username || 'Anonymous'
      }));
    }
  };

  // Add error handling for missing auth context
  useEffect(() => {
    if (!authContext) {
      console.warn("AuthContext is not available in TypeaheadSearch");
    }
  }, [authContext]);

  const fetchResults = useCallback(
    debounce(async (search, user) => {
      if (!user && !userId) {
        // Skip search if no user context is available
        return;
      }

      // Check if we're in the link editor context
      const isLinkEditor = !!setDisplayText;

      // Minimal logging to reduce console noise
      console.log('TypeaheadSearch - Searching:', search);

      setIsSearching(true);
      try {
        let selectedUserId = userId ? userId : user.uid;
        let groupIds = [];
        if (user && user.groups) {
          groupIds = Object.keys(user.groups);
        }

        // Determine if we should filter by a specific user ID
        const isFilteringByUser = !!userId;

        // IMPORTANT FIX: Ensure search term is properly encoded
        // For link editor context, allow empty search terms to fetch recent pages
        const searchTerm = isLinkEditor && !search.trim() ? '' : search.trim();
        const encodedSearch = encodeURIComponent(searchTerm);
        console.log(`TypeaheadSearch - Encoded search term: "${encodedSearch}" (in ${isLinkEditor ? 'link editor' : 'regular search'})`);

        // Construct the API URL based on whether we're filtering by user
        let queryUrl;
        if (isFilteringByUser) {
          // When filtering by user, we want to search only that user's pages
          queryUrl = `/api/search?userId=${selectedUserId}&searchTerm=${encodedSearch}&filterByUserId=${userId}&groupIds=${groupIds}`;
        } else {
          // Normal search across all accessible pages
          queryUrl = `/api/search?userId=${selectedUserId}&searchTerm=${encodedSearch}&groupIds=${groupIds}`;
        }

        // Only search for users if we're not filtering by a specific user
        const userSearchUrl = isFilteringByUser ? null : `/api/search-users?searchTerm=${encodedSearch}`;

        console.log('Making API requests to:', {
          queryUrl,
          userSearchUrl,
          isFilteringByUser,
          filterByUserId: userId
        });

        // Add timeout to prevent infinite loading
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        try {
          // Determine which requests to make based on filtering
          const fetchPromises = [
            fetch(queryUrl, {
              signal: controller.signal,
              cache: 'no-store' // Prevent caching of search results
            })
          ];

          // Only fetch users if we're not filtering by a specific user
          // CRITICAL FIX: Add error handling for user search
          if (!isFilteringByUser && userSearchUrl) {
            try {
              fetchPromises.push(
                fetch(userSearchUrl, {
                  signal: controller.signal,
                  cache: 'no-store' // Prevent caching of search results
                })
              );
            } catch (userFetchError) {
              console.warn('Error setting up user search fetch:', userFetchError);
              // Provide a mock successful response with empty users array
              fetchPromises.push(Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ users: [] })
              }));
            }
          }

          // Fetch pages and optionally users in parallel using Promise.allSettled to handle partial failures
          const responses = await Promise.allSettled(fetchPromises);

          // Extract responses
          const pagesResponse = responses[0];
          const usersResponse = isFilteringByUser ?
            { status: 'fulfilled', value: { ok: true, json: () => Promise.resolve({ users: [] }) } } :
            responses[1];

          clearTimeout(timeoutId);

          // Process page results
          let processedPages = [];
          if (pagesResponse.status === 'fulfilled' && pagesResponse.value.ok) {
            try {
              const pagesData = await pagesResponse.value.json();
              console.log('TypeaheadSearch - Pages API response:', pagesData);

              // Check if we received an error message
              if (pagesData.error) {
                console.error('TypeaheadSearch - Pages API returned error object:', pagesData.error);
                // Continue processing - we'll still use any pages that were returned
              }

              // Process the results with usernames
              if (pagesData && pagesData.pages) {
                // Log search term and matching titles for debugging
                console.log(`TypeaheadSearch - Found ${pagesData.pages.length} pages for "${search}"`);

                if (pagesData.pages.length > 0) {
                  console.log('TypeaheadSearch - Matching page titles:',
                    pagesData.pages.map(page => page.title).join(', '));

                  // Filter out any fallback/suggested results
                  const realPages = pagesData.pages.filter(page => !page.isFallback);
                  console.log(`TypeaheadSearch - Filtered out ${pagesData.pages.length - realPages.length} fallback results`);

                  processedPages = await processPagesWithUsernames(realPages);
                } else {
                  console.log('TypeaheadSearch - No matching pages found');
                }
              } else {
                // IMPORTANT FIX: Handle case where pages array is missing
                console.warn('TypeaheadSearch - Pages API response missing "pages" array:', pagesData);
              }

              // Log the source of the search results
              if (pagesData.source) {
                console.log(`TypeaheadSearch - Results source: ${pagesData.source}`);

                // If we're using a fallback, let the user know
                if (pagesData.source.includes('fallback')) {
                  console.log('TypeaheadSearch - Using Firestore fallback search');
                }
              }
            } catch (jsonError) {
              console.error('TypeaheadSearch - Error parsing pages API response:', jsonError);
              // Reset processed pages to empty array on error
              processedPages = [];
            }
          } else {
            console.error('TypeaheadSearch - Pages API request failed:',
              pagesResponse.status === 'rejected' ? pagesResponse.reason :
              `HTTP ${pagesResponse.value?.status || 'unknown'}`);
          }

          // Process user results with improved error handling
          let users = [];
          if (usersResponse.status === 'fulfilled' && usersResponse.value && usersResponse.value.ok) {
            try {
              const usersData = await usersResponse.value.json();

              // CRITICAL FIX: Handle missing users array gracefully
              if (usersData && Array.isArray(usersData.users)) {
                // Filter out any fallback/suggested user results
                users = usersData.users.filter(user => !user.isFallback);
                console.log(`Found ${users.length} matching users`);
              } else {
                // If users array is missing, use an empty array
                console.log('No users array in response, using empty array');
              }
            } catch (jsonError) {
              console.warn('Error parsing users response:', jsonError.message);
              // Reset users to empty array on error
              users = [];
            }
          } else {
            // Handle rejected or failed responses silently
            console.log('User search unavailable, continuing with pages only');
          }

          // Only log when no results are found in both pages and users
          if (processedPages.length === 0 && users.length === 0 && search && search.trim().length > 0) {
            console.log(`No results found for: ${search}`);
          }

          // Set the pages state with categorized results
          setPages({
            userPages: processedPages.filter(page => page.type === 'user' || page.isOwned),
            groupPages: processedPages.filter(page => page.type === 'group' && !page.isOwned),
            publicPages: processedPages.filter(page => page.type === 'public' && !page.isOwned),
            users: users // Add the users to the state
          });
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
        setPages({
          userPages: [],
          groupPages: [],
          publicPages: []
        });
      } finally {
        setIsSearching(false);
      }
    }, 500),
    [userId, setDisplayText]
  );

  const resetSearchResults = useCallback(() => {
    setPages({
      userPages: [],
      groupPages: [],
      publicPages: [],
      users: []
    });
    setIsSearching(false);
  }, []);

  useEffect(() => {
    // Determine if we're in the link editor context
    const isLinkEditor = !!setDisplayText;

    if (!search) {
      // Reset results for empty search term
      resetSearchResults();
      return;
    }

    if (!user && !userId) {
      // Skip search if no user context is available
      return;
    }

    // CRITICAL FIX: Always make the request in the link editor context
    // Otherwise, only search if we have at least the minimum number of characters
    const hasMinimumChars = search.trim().length >= characterCount;

    if (!hasMinimumChars && !isLinkEditor) {
      // Skip search for short terms outside link editor
      resetSearchResults();
      return;
    }

    // In link editor context, always trigger search regardless of search term length
    // For regular search, only search if we have at least one character
    if (isLinkEditor || search.trim().length > 0) {
      fetchResults(search.trim(), user);
    }
  }, [search, user, userId, fetchResults, setDisplayText, resetSearchResults, characterCount]);

  useEffect(() => {
    if (onSelect) {
      // make the input active when the user starts typing
      const searchElement = document.getElementById("search-input");
      if (searchElement) {
        searchElement.focus();
      }
    }
  }, [onSelect]);

  // Effect to trigger search when initialSearch is provided
  useEffect(() => {
    // Determine if we're in the link editor context
    const isLinkEditor = !!setDisplayText;

    if (user || userId) {
      // CRITICAL FIX: In link editor context, always perform a search
      // This ensures we have results available immediately
      if (isLinkEditor) {
        // Use initialSearch if provided, otherwise empty string
        const searchTerm = initialSearch ? initialSearch.trim() : '';
        fetchResults(searchTerm, user);
      }
      // For regular search, only search if initialSearch meets minimum length
      else if (initialSearch && initialSearch.trim().length >= characterCount) {
        fetchResults(initialSearch.trim(), user);
      }
    }
  }, [initialSearch, user, userId, fetchResults, setDisplayText, characterCount]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearch(value);

    // If onInputChange prop is provided, call it with the new value
    if (typeof onInputChange === 'function') {
      onInputChange(value);
    }
  };

  const handleClear = () => {
    setSearch('');
    resetSearchResults();
    if (onInputChange) {
      // Create a synthetic event for clearing
      const syntheticEvent = {
        target: { value: '' }
      };
      onInputChange(syntheticEvent);
    }
  };

  // Helper function to deduplicate pages by ID
  const deduplicatePages = useCallback((allPages) => {
    const uniquePages = new Map();

    // Process pages in order of priority: user pages first, then group pages, then public pages
    allPages.forEach(page => {
      // Only add the page if it's not already in our map
      if (!uniquePages.has(page.id)) {
        uniquePages.set(page.id, page);
      }
    });

    return Array.from(uniquePages.values());
  }, []);

  // Get all unique pages across all categories
  const getAllUniquePages = useCallback(() => {
    const allPages = [...pages.userPages, ...pages.groupPages, ...pages.publicPages];
    return deduplicatePages(allPages);
  }, [pages.userPages, pages.groupPages, pages.publicPages, deduplicatePages]);

  // Update display text when a page is selected
  useEffect(() => {
    if (selectedId && setDisplayText) {
      const selectedPage = getAllUniquePages().find(page => page.id === selectedId);

      if (selectedPage && !displayText) {
        setDisplayText(selectedPage.title);
      }
    }
  }, [selectedId, getAllUniquePages, setDisplayText, displayText]);

  if (!user) return null;
  return (
    <div className="flex flex-col" id="typeahead-search">
      <div className="flex flex-col space-y-3">
        {/* Display Text Input - Only show when setDisplayText is provided (in link editor) */}
        {setDisplayText && (
          <div className="flex flex-col space-y-1">
            <label htmlFor="display-text" className="text-sm font-medium">Display Text</label>
            <input
              id="display-text"
              type="text"
              value={displayText}
              onChange={(e) => setDisplayText(e.target.value)}
              placeholder={selectedId ?
                [...pages.userPages, ...pages.groupPages, ...pages.publicPages]
                  .find(page => page.id === selectedId)?.title || "Link text"
                : "Link text"}
              className="w-full px-3 py-2 border border-border dark:border-border rounded-md"
            />
          </div>
        )}

        <div className="flex flex-col space-y-1">
          {setDisplayText && <label htmlFor="search-input" className="text-sm font-medium">Page</label>}
          <div className="relative w-full">
          {selectedId ? (
            <div className="flex items-center w-full border border-border dark:border-border rounded-md px-3 py-2 bg-background">
              {(() => {
                // Find the selected page from deduplicated list
                const selectedPage = getAllUniquePages().find(page => page.id === selectedId);

                return selectedPage ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      <span className="inline-flex px-2 py-1 bg-primary text-white rounded-md mr-2">
                        {selectedPage.title}
                        <X
                          className="h-4 w-4 ml-1.5 cursor-pointer"
                          onClick={() => {
                            setSelectedId(null);
                            setSearch('');
                          }}
                        />
                      </span>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          ) : (
            <>
              <Input
                id="search-input"
                type="text"
                placeholder={placeholder}
                value={search}
                onChange={handleInputChange}
                onFocus={() => setShowResults && setShowResults(true)}
                className={`w-full ${showClearButton && search ? 'pr-20' : 'pr-10'} ${className}`}
                autoComplete="off"
              />
              {/* Clear button for search page mode */}
              {showClearButton && search && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors pointer-events-auto"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </>
          )}
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
        className={`mt-2 space-y-1 transition-all max-h-[40vh] overflow-y-auto ${
          // Always show results in link editor context (when setDisplayText is provided)
          // In search page mode, show results when there's a search term
          // Otherwise, only show if search term meets minimum length
          (search.length >= characterCount || !!setDisplayText || (searchPageMode && search.length > 0))
            ? "opacity-100"
            : "opacity-0"
        } ${searchPageMode ? 'bg-background border border-border rounded-lg shadow-lg absolute z-50 w-full' : ''}`}
      >
        {isSearching && (search.length >= characterCount || !!setDisplayText) ? (
          <Loader />
        ) : (
          <>
            {/* User accounts section */}
            {pages.users && pages.users.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-medium text-muted-foreground px-3 py-1 uppercase">Users</div>
                {pages.users.map((user) =>
                  onSelect ? (
                    <UserItemButton
                      user={user}
                      search={search}
                      onSelect={onSelect}
                      searchPageMode={searchPageMode}
                      onSearchPageSelect={onSearchPageSelect}
                      key={user.id}
                    />
                  ) : (
                    <UserItemLink
                      user={user}
                      search={search}
                      searchPageMode={searchPageMode}
                      onSearchPageSelect={onSearchPageSelect}
                      key={user.id}
                    />
                  )
                )}
              </div>
            )}

            {/* Pages section - using deduplicated pages */}
            {getAllUniquePages().length > 0 && (
              <div>
                {/* Group pages by type for better organization */}
                {(() => {
                  const uniquePages = getAllUniquePages();

                  // Create sections based on page types
                  const userOwnedPages = uniquePages.filter(page => page.isOwned || page.type === 'user');
                  const groupPages = uniquePages.filter(page => !page.isOwned && page.type === 'group');
                  const publicPages = uniquePages.filter(page => !page.isOwned && page.type === 'public');

                  return (
                    <>
                      {/* User pages section */}
                      {userOwnedPages.length > 0 && (
                        <div className="mb-2">
                          {userOwnedPages.length > 0 && groupPages.length + publicPages.length > 0 && (
                            <div className="text-xs font-medium text-muted-foreground px-3 py-1 uppercase">Your Pages</div>
                          )}
                          {userOwnedPages
                            .filter((page) => !editableOnly || page.isOwned || page.isEditable)
                            .map((page) =>
                              onSelect ? (
                                <SingleItemButton
                                  page={page}
                                  search={search}
                                  onSelect={onSelect}
                                  isSelected={selectedId === page.id}
                                  setSearch={setSearch}
                                  setSelectedId={setSelectedId}
                                  searchPageMode={searchPageMode}
                                  onSearchPageSelect={onSearchPageSelect}
                                  key={page.id}
                                />
                              ) : (
                                <SingleItemLink
                                  page={page}
                                  search={search}
                                  searchPageMode={searchPageMode}
                                  onSearchPageSelect={onSearchPageSelect}
                                  key={page.id}
                                />
                              )
                            )}
                        </div>
                      )}

                      {/* Group pages section */}
                      {groupPages.length > 0 && (
                        <div className="mb-2">
                          {groupPages.length > 0 && (userOwnedPages.length > 0 || publicPages.length > 0) && (
                            <div className="text-xs font-medium text-muted-foreground px-3 py-1 uppercase">Group Pages</div>
                          )}
                          {groupPages
                            .filter((page) => !editableOnly || page.isOwned || page.isEditable)
                            .map((page) =>
                              onSelect ? (
                                <SingleItemButton
                                  page={page}
                                  search={search}
                                  onSelect={onSelect}
                                  isSelected={selectedId === page.id}
                                  setSearch={setSearch}
                                  setSelectedId={setSelectedId}
                                  searchPageMode={searchPageMode}
                                  onSearchPageSelect={onSearchPageSelect}
                                  key={page.id}
                                />
                              ) : (
                                <SingleItemLink
                                  page={page}
                                  search={search}
                                  searchPageMode={searchPageMode}
                                  onSearchPageSelect={onSearchPageSelect}
                                  key={page.id}
                                />
                              )
                            )}
                        </div>
                      )}

                      {/* Public pages section */}
                      {publicPages.length > 0 && (
                        <div>
                          {publicPages.length > 0 && (userOwnedPages.length > 0 || groupPages.length > 0) && (
                            <div className="text-xs font-medium text-muted-foreground px-3 py-1 uppercase">Public Pages</div>
                          )}
                          {publicPages
                            .filter((page) => !editableOnly || page.isOwned || page.isEditable)
                            .map((page) =>
                              onSelect ? (
                                <SingleItemButton
                                  page={page}
                                  search={search}
                                  onSelect={onSelect}
                                  isSelected={selectedId === page.id}
                                  setSearch={setSearch}
                                  setSelectedId={setSelectedId}
                                  searchPageMode={searchPageMode}
                                  onSearchPageSelect={onSearchPageSelect}
                                  key={page.id}
                                />
                              ) : (
                                <SingleItemLink
                                  page={page}
                                  search={search}
                                  searchPageMode={searchPageMode}
                                  onSearchPageSelect={onSearchPageSelect}
                                  key={page.id}
                                />
                              )
                            )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {search.length >= 2 && getAllUniquePages().length === 0 && (
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
                          router.push(`/${newPageId}?edit=true`);
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

      {/* We've moved the Insert Link button to the DialogFooter in AddToPageButton.js */}
      {onSelect && selectedId && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          {getAllUniquePages().find(page => page.id === selectedId)?.title} selected
        </div>
      )}
    </div>
  );
};

const SingleItemLink = ({ page, search, searchPageMode = false, onSearchPageSelect = null }) => {
  const handleClick = () => {
    if (searchPageMode && onSearchPageSelect) {
      onSearchPageSelect(page);
    }
  };

  return (
    <div
      className={`flex items-center w-full overflow-hidden my-1 ${searchPageMode ? 'px-3 py-2 hover:bg-accent/50 rounded-md cursor-pointer' : ''}`}
      onClick={searchPageMode ? handleClick : undefined}
    >
      <PillLink
        href={`/${page.id}`}
        key={page.id}
        isPublic={page.isPublic}
        className="flex-shrink-0"
      >
        <span className="truncate">{highlightText(page.title, search)}</span>
      </PillLink>
      {page.username && page.username !== 'NULL' && (
        <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
          by {page.username}
        </span>
      )}
    </div>
  );
};

const SingleItemButton = ({ page, search, isSelected = false, setSearch, setSelectedId, onSelect, searchPageMode = false, onSearchPageSelect = null }) => {
  // Ensure we have a valid username to display (handle NULL values properly)
  const displayName = page.username && page.username !== 'NULL'
    ? page.username
    : 'Anonymous';

  const handleClick = () => {
    if (searchPageMode && onSearchPageSelect) {
      onSearchPageSelect(page);
    } else {
      setSelectedId(page.id);
      // Call onSelect with the page data
      if (onSelect) {
        onSelect({
          ...page,
          displayText: page.title
        });
      }
    }
  };

  return (
    <div className="flex items-center w-full overflow-hidden my-1">
      <button
        onClick={handleClick}
        className={`inline-flex px-3 py-1.5 items-center whitespace-nowrap text-sm font-medium rounded-[12px] ${isSelected
          ? 'bg-primary text-white border-[1.5px] border-primary-foreground/20'
          : 'bg-blue-500 text-white border-[1.5px] border-blue-600 hover:bg-blue-600 hover:border-blue-700'
        } transition-colors flex-shrink-0`}
        key={page.id}
      >
        <span className="truncate">
          {highlightText(page.title, search)}
        </span>
        {isSelected && (
          <X className="h-3.5 w-3.5 ml-1.5 flex-shrink-0" onClick={(e) => {
            e.stopPropagation();
            setSearch('');
            setSelectedId(null);
            // Clear selection
            if (onSelect) {
              onSelect(null);
            }
          }} />
        )}
      </button>
      <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
        {page.groupId ? 'Group' : `by ${displayName}`}
      </span>
    </div>
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

// User item components
const UserItemLink = ({ user, search, searchPageMode = false, onSearchPageSelect = null }) => {
  const handleClick = () => {
    if (searchPageMode && onSearchPageSelect) {
      onSearchPageSelect({ ...user, type: 'user' });
    }
  };

  return (
    <div
      className={`flex items-center w-full overflow-hidden my-1 px-3 py-1.5 hover:bg-accent/50 rounded-md ${searchPageMode ? 'cursor-pointer' : ''}`}
      onClick={searchPageMode ? handleClick : undefined}
    >
      <PillLink
        href={`/user/${user.id}`}
        key={user.id}
        className="flex-shrink-0"
      >
        <span className="truncate">{highlightText(user.username, search)}</span>
      </PillLink>
      <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
        User
      </span>
    </div>
  );
};

const UserItemButton = ({ user, search, onSelect, searchPageMode = false, onSearchPageSelect = null }) => {
  const handleClick = () => {
    if (searchPageMode && onSearchPageSelect) {
      onSearchPageSelect({ ...user, type: 'user' });
    } else if (onSelect) {
      onSelect({
        id: user.id,
        title: user.username,
        type: 'user',
        url: `/user/${user.id}`
      });
    }
  };

  return (
    <div className="flex items-center w-full overflow-hidden my-1">
      <button
        onClick={handleClick}
        className="inline-flex px-3 py-1.5 items-center whitespace-nowrap text-sm font-medium rounded-[12px] bg-blue-500 text-white border-[1.5px] border-blue-600 hover:bg-blue-600 hover:border-blue-700 transition-colors flex-shrink-0"
      >
        {highlightText(user.username, search)}
      </button>
      <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
        User
      </span>
    </div>
  );
};

export default TypeaheadSearch;
