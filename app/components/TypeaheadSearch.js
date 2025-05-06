"use client";
import React, {
  useEffect,
  useState,
  useContext,
  useCallback,
  useRef,
  Children,
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
import { getBasePageSearchRules, getUserPageSearchRules, buildSearchQueryUrl, applyPrivacyFiltering } from "../utils/searchRules";
import { Switch } from "./ui/switch";
import { performClientSideSearch } from "../utils/clientSideSearch";

// Define a simple Loader component directly in this file
const Loader = () => {
  return (
    <div className="flex justify-center items-center p-4">
      <div className="animate-spin h-5 w-5 border-2 border-gray-500 rounded-full border-t-transparent"></div>
    </div>
  );
};

// Minimum characters required to trigger a search
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
  preventRedirect = false, // New prop to prevent redirection after page creation
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
        console.log('TypeaheadSearch - No user or userId provided, skipping search');
        return;
      }

      // Split search term into words for better debugging
      const searchWords = search?.trim().toLowerCase().split(/\s+/).filter(word => word.length > 0) || [];
      const hasMultipleWords = searchWords.length > 1;

      console.log('TypeaheadSearch - Fetching results for:', {
        search,
        searchLength: search?.length,
        searchTrimmed: search?.trim(),
        searchTrimmedLength: search?.trim()?.length,
        searchWords,
        hasMultipleWords,
        userId: userId || user?.uid,
        filterByUserId: userId, // Log if we're filtering by a specific user
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

        // Get search rules based on whether we're filtering by a specific user
        const searchRules = userId
          ? getUserPageSearchRules(userId, selectedUserId)
          : getBasePageSearchRules();

        // Determine if we should filter by a specific user ID
        const isFilteringByUser = !!userId;

        // Build the search query URL using our centralized search rules
        const queryUrl = buildSearchQueryUrl({
          userId: selectedUserId,
          searchTerm: search,
          groupIds,
          filterByUserId: isFilteringByUser ? userId : null,
          useScoring: searchRules.useScoring
        });

        // Only search for users if we're not filtering by a specific user
        const userSearchUrl = isFilteringByUser ? null : `/api/search-users?searchTerm=${encodeURIComponent(search)}`;

        console.log('Making API requests to:', {
          queryUrl,
          userSearchUrl,
          isFilteringByUser,
          filterByUserId: userId
        });

        // Add timeout to prevent infinite loading
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout (increased from 10s)

        // Add more comprehensive error handling for fetch
        let responses = [];

        // Determine which requests to make based on filtering
        const fetchPromises = [
          fetch(queryUrl, {
            signal: controller.signal,
            cache: 'no-store' // Prevent caching of search results
          }).catch(error => {
            console.error('TypeaheadSearch - Error fetching pages:', error);
            // Return a rejected promise to be caught by Promise.allSettled
            return Promise.reject(error);
          })
        ];

        // Only fetch users if we're not filtering by a specific user
        if (!isFilteringByUser && userSearchUrl) {
          fetchPromises.push(
            fetch(userSearchUrl, {
              signal: controller.signal,
              cache: 'no-store' // Prevent caching of search results
            }).catch(error => {
              console.error('TypeaheadSearch - Error fetching users:', error);
              // Return a rejected promise to be caught by Promise.allSettled
              return Promise.reject(error);
            })
          );
        }

        try {
          // Fetch pages and optionally users in parallel using Promise.allSettled to handle partial failures
          responses = await Promise.allSettled(fetchPromises);
        } catch (connectionError) {
          console.error('TypeaheadSearch - Connection error:', connectionError);
          // Create rejected responses for both requests
          responses = [
            { status: 'rejected', reason: connectionError },
            { status: 'rejected', reason: connectionError }
          ];
        }

        // Extract responses
        const pagesResponse = responses[0];
        const usersResponse = isFilteringByUser ? { status: 'fulfilled', value: { ok: true, json: () => Promise.resolve({ users: [] }) } } : responses[1];

        clearTimeout(timeoutId);

        // Process page results
        let processedPages = [];
        let apiSuccess = false;

        if (pagesResponse.status === 'fulfilled' && pagesResponse.value.ok) {
          try {
            const pagesData = await pagesResponse.value.json();
            console.log('TypeaheadSearch - Pages API response:', pagesData);

            // Check if we received an error message
            if (pagesData.error) {
              console.error('TypeaheadSearch - Pages API returned error object:', pagesData.error);
            } else {
              // Process the results with usernames
              if (pagesData && pagesData.pages) {
                processedPages = await processPagesWithUsernames(pagesData.pages);
                apiSuccess = true;
              }
            }
          } catch (jsonError) {
            console.error('TypeaheadSearch - Error parsing pages API response:', jsonError);
          }
        } else {
          console.error('TypeaheadSearch - Pages API request failed:',
            pagesResponse.status === 'rejected' ? pagesResponse.reason :
            `HTTP ${pagesResponse.value?.status || 'unknown'}`);
        }

        // Process user results
        let users = [];
        let usersApiSuccess = false;

        if (usersResponse.status === 'fulfilled' && usersResponse.value.ok) {
          try {
            const usersData = await usersResponse.value.json();
            console.log('TypeaheadSearch - Users API response:', usersData);

            if (usersData && usersData.users) {
              users = usersData.users;
              usersApiSuccess = true;
            }
          } catch (jsonError) {
            console.error('TypeaheadSearch - Error parsing users API response:', jsonError);
          }
        } else {
          console.error('TypeaheadSearch - Users API request failed:',
            usersResponse.status === 'rejected' ? usersResponse.reason :
            `HTTP ${usersResponse.value?.status || 'unknown'}`);
        }

        // If both API calls failed, use client-side search as fallback
        if (!apiSuccess || !usersApiSuccess) {
          console.log('TypeaheadSearch - Using client-side search fallback');
          const clientSideResults = performClientSideSearch(search, selectedUserId);

          // Only use client-side results if API calls failed
          if (!apiSuccess && clientSideResults.pages.length > 0) {
            console.log('TypeaheadSearch - Using client-side page results:', clientSideResults.pages);
            processedPages = clientSideResults.pages;
          }

          if (!usersApiSuccess && clientSideResults.users.length > 0) {
            console.log('TypeaheadSearch - Using client-side user results:', clientSideResults.users);
            users = clientSideResults.users;
          }
        }

        // Log search results with detailed information
        if (processedPages.length === 0 && users.length === 0 && search) {
          console.warn(`TypeaheadSearch - No results found for search term: "${search}"`);
        } else {
          console.log(`TypeaheadSearch - Found ${processedPages.length} pages and ${users.length} users for search term: "${search}"`);

          // Log page titles for debugging
          if (processedPages.length > 0) {
            console.log('Page results:', processedPages.map(page => ({
              id: page.id,
              title: page.title,
              type: page.type,
              containsAllSearchWords: page.containsAllSearchWords,
              matchScore: page.matchScore
            })));
          }
        }

        // Apply privacy filtering to ensure we don't show private pages to users who shouldn't see them
        const filteredPages = applyPrivacyFiltering(processedPages, selectedUserId);

        // Set the pages state with categorized results
        setPages({
          userPages: filteredPages.filter(page => page.type === 'user' || page.isOwned),
          groupPages: filteredPages.filter(page => page.type === 'group' && !page.isOwned),
          publicPages: filteredPages.filter(page => page.type === 'public' && !page.isOwned),
          users: users // Add the users to the state
        });
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
    }, 300),
    [userId]
  );

  const resetSearchResults = () => {
    setPages({
      userPages: [],
      groupPages: [],
      publicPages: [],
      users: []
    });
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

  // Effect to trigger search when initialSearch is provided
  useEffect(() => {
    if (initialSearch && initialSearch.trim().length >= characterCount && user) {
      console.log('TypeaheadSearch - Initial search triggered with:', initialSearch);
      fetchResults(initialSearch.trim(), user);
    }
  }, [initialSearch, user, fetchResults]);

  const handleInputChange = (e) => {
    setSearch(e.target.value);
  };

  // Handle Enter key press to navigate to search page
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault();
      console.log('TypeaheadSearch - Navigating to search page with query:', search);
      router.push(`/search?q=${encodeURIComponent(search.trim())}`);
    }
  };

  // Helper function to deduplicate pages by ID
  const deduplicatePages = (allPages) => {
    const uniquePages = new Map();

    // Process pages in order of priority: user pages first, then group pages, then public pages
    allPages.forEach(page => {
      // Only add the page if it's not already in our map
      if (!uniquePages.has(page.id)) {
        uniquePages.set(page.id, page);
      }
    });

    return Array.from(uniquePages.values());
  };

  // Get all unique pages across all categories
  const getAllUniquePages = () => {
    const allPages = [...pages.userPages, ...pages.groupPages, ...pages.publicPages];

    // First deduplicate the pages
    const dedupedPages = deduplicatePages(allPages);

    // Then sort them by priority:
    // 1. Pages that contain all search words
    // 2. Pages with higher match scores
    // 3. Pages with better match quality (exact > startsWith > wordStartsWith > contains)
    // 4. User's own pages
    // 5. Recently modified pages
    return dedupedPages.sort((a, b) => {
      // First prioritize pages that contain all search words
      if (a.containsAllSearchWords && !b.containsAllSearchWords) return -1;
      if (!a.containsAllSearchWords && b.containsAllSearchWords) return 1;

      // Then prioritize by match score if available
      if (a.matchScore && b.matchScore && a.matchScore !== b.matchScore) {
        return b.matchScore - a.matchScore;
      }

      // Then prioritize by match quality if available
      if (a.matchQuality && b.matchQuality && a.matchQuality !== b.matchQuality) {
        const qualityRank = {
          'exact': 4,
          'startsWith': 3,
          'wordStartsWith': 2,
          'contains': 1
        };
        return qualityRank[a.matchQuality] > qualityRank[b.matchQuality] ? -1 : 1;
      }

      // Then prioritize user's own pages
      if (a.isOwned && !b.isOwned) return -1;
      if (!a.isOwned && b.isOwned) return 1;

      // Finally sort by last modified date
      const dateA = new Date(a.lastModified || 0);
      const dateB = new Date(b.lastModified || 0);
      return dateB - dateA;
    });
  };  // Update display text when a page is selected
  useEffect(() => {
    if (selectedId && setDisplayText) {
      const selectedPage = getAllUniquePages().find(page => page.id === selectedId);

      if (selectedPage && !displayText) {
        setDisplayText(selectedPage.title);
      }
    }
  }, [selectedId, pages, setDisplayText, displayText]);

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
            <Input
              id="search-input"
              type="text"
              placeholder={placeholder}
              value={search}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowResults && setShowResults(true)}
              className="w-full pr-10"
              autoComplete="off"
            />
          )}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {isSearching ? (
              <Loader />
            ) : (
              <Search
                className="h-5 w-5 text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                onClick={() => {
                  if (search.trim()) {
                    console.log('TypeaheadSearch - Navigating to search page via icon click with query:', search);
                    router.push(`/search?q=${encodeURIComponent(search.trim())}`);
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div
        className={`mt-2 space-y-1 transition-all max-h-[300px] overflow-y-auto ${
          search.length >= characterCount
            ? "opacity-100"
            : "opacity-0"
        }`}
      >
        {isSearching && search.length >= characterCount ? (
          <div className="flex justify-center items-center py-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
              <span className="text-sm text-muted-foreground">Searching...</span>
            </div>
          </div>
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
                      key={user.id}
                    />
                  ) : (
                    <UserItemLink
                      user={user}
                      search={search}
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
                    </>
                  );
                })()}
              </div>
            )}

            {search.length >= 2 && !isSearching && getAllUniquePages().length === 0 && (
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

                          // Only redirect if preventRedirect is false
                          if (!preventRedirect) {
                            // Redirect to the edit view of the newly created page
                            router.push(`/${newPageId}?edit=true`);
                          }
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

      {/* Insert Link button - only show when onSelect is provided */}
      {onSelect && (
        <div className="mt-4 flex justify-end sticky bottom-0 pt-2 pb-1 bg-background border-t border-border dark:border-border">
          <button
            onClick={() => {
              if (selectedId) {
                // Find the selected page from deduplicated list
                const selectedPage = getAllUniquePages().find(page => page.id === selectedId);

                if (selectedPage && onSelect) {
                  // Include display text in the selected page object
                  onSelect({
                    ...selectedPage,
                    displayText: displayText || selectedPage.title
                  });
                }
              }
            }}
            disabled={!selectedId}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Insert Link
          </button>
        </div>
      )}
    </div>
    </div>
  );
};

const SingleItemLink = ({ page, search }) => {
  return (
    <div className="flex items-center w-full overflow-hidden my-1">
      <PillLink
        href={`/${page.id}`}
        key={page.id}
        isPublic={page.isPublic}
        className="flex-shrink-0 whitespace-nowrap"
      >
        <span className="truncate">{highlightText(page.title, search)}</span>
      </PillLink>
    </div>
  );
};

const SingleItemButton = ({ page, search, onSelect, isSelected = false, setSearch, setSelectedId }) => {
  // Split search into words for highlighting
  const searchWords = search?.trim().toLowerCase().split(/\s+/).filter(word => word.length > 0) || [];
  const hasMultipleWords = searchWords.length > 1;

  return (
    <div className="flex items-center w-full overflow-hidden my-1">
      <button
        onClick={() => {
          setSelectedId(page.id);
          // Don't call onSelect here, wait for Insert Link button
        }}
        className={`inline-flex px-3 py-1.5 items-center whitespace-nowrap text-sm font-medium rounded-[12px] ${
          isSelected
            ? 'bg-primary text-white border-[1.5px] border-primary-foreground/20'
            : page.containsAllSearchWords && hasMultipleWords
              ? 'bg-green-600 text-white border-[1.5px] border-green-700 hover:bg-green-700 hover:border-green-800'
              : 'bg-blue-500 text-white border-[1.5px] border-blue-600 hover:bg-blue-600 hover:border-blue-700'
        } transition-colors flex-shrink-0`}
        key={page.id}
      >
        <span className="truncate">
          {highlightText(page.title, search)}
        </span>
      </button>
    </div>
  );
};

const UserItemLink = ({ user, search }) => {
  return (
    <div className="flex items-center w-full overflow-hidden my-1">
      <PillLink
        href={`/user/${user.id}`}
        key={user.id}
        className="flex-shrink-0 whitespace-nowrap bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        <span className="truncate">@{highlightText(user.username, search)}</span>
      </PillLink>
    </div>
  );
};

const UserItemButton = ({ user, search, onSelect }) => {
  return (
    <div className="flex items-center w-full overflow-hidden my-1">
      <button
        onClick={() => {
          if (onSelect) {
            onSelect({
              id: user.id,
              username: user.username,
              type: 'user'
            });
          }
        }}
        className="inline-flex px-3 py-1.5 items-center whitespace-nowrap text-sm font-medium rounded-[12px] bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
        key={user.id}
      >
        <span className="truncate">@{highlightText(user.username, search)}</span>
      </button>
    </div>
  );
};

// Helper function to highlight search terms in text
const highlightText = (text, searchTerm) => {
  if (!searchTerm || !text) return text;

  // Split search term into words for multi-word highlighting
  const searchWords = searchTerm.trim().toLowerCase().split(/\s+/).filter(word => word.length > 0);

  // For single-word searches, use a more flexible approach that highlights partial matches
  if (searchWords.length <= 1) {
    // First try to find exact matches of the search term
    const exactRegex = new RegExp(`(${searchTerm})`, "gi");
    if (text.toLowerCase().match(exactRegex)) {
      const parts = text.split(exactRegex);
      return parts.map((part, index) =>
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <span key={index} className="text-primary">
            {part}
          </span>
        ) : (
          part
        )
      );
    }

    // If no exact matches, look for words that start with the search term
    const words = text.split(/\b/);
    const searchTermLower = searchTerm.toLowerCase();

    return words.map((word, index) => {
      if (word.toLowerCase().startsWith(searchTermLower)) {
        return (
          <span key={index}>
            <span className="text-primary">{word.substring(0, searchTerm.length)}</span>
            {word.substring(searchTerm.length)}
          </span>
        );
      }
      return word;
    });
  }

  // For multi-word searches, highlight each word
  let highlightedText = text;
  const textLower = text.toLowerCase();

  // First check for exact phrase match
  if (textLower.includes(searchTerm.toLowerCase())) {
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
  }

  // Then check for individual word matches
  return (
    <span>
      {searchWords.reduce((acc, word, wordIndex) => {
        if (!word) return acc;

        const regex = new RegExp(`(${word})`, "gi");
        return acc.map((part, partIndex) => {
          if (typeof part === 'string') {
            const subParts = part.split(regex);
            return subParts.map((subPart, subPartIndex) =>
              subPart.toLowerCase() === word.toLowerCase() ? (
                <span key={`${wordIndex}-${partIndex}-${subPartIndex}`} className="text-primary">
                  {subPart}
                </span>
              ) : (
                subPart
              )
            );
          }
          return part;
        }).flat();
      }, [text])}
    </span>
  );
};

export default TypeaheadSearch;
