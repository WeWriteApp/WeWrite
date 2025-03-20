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
  setShowDropdown = null,
  userId = null,
  placeholder = "Search..."
}) => {
  const [search, setSearch] = useState("");
  const { user } = useContext(AuthContext);
  const [userPages, setUserPages] = useState([]);
  const [groupPages, setGroupPages] = useState([]);
  const [publicPages, setPublicPages] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const { theme } = useTheme();

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
        
        const response = await fetch(queryUrl);
        
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

  useEffect(() => {
    if (!search) {
      setUserPages([]);
      setGroupPages([]);
      setPublicPages([]);
      return;
    }
    if (!user) return;

    // if search less than minimum characters, don't make request
    if (search.length < characterCount || !search.trim()) {
      setUserPages([]);
      setGroupPages([]);
      setPublicPages([]);
      return;
    }

    fetchResults(search.trim(), user);
  }, [search, user, fetchResults]);

  useEffect(() => {
    if (onSelect) {
      // make the input active when the user starts typing
      document.getElementById("search").focus();
    }
  }, [onSelect]);

  if (!user) return null;
  return (
    <div className="flex flex-col" id="typeahead-search">
      <div className="flex flex-col space-y-1">
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <input
            className="w-full pl-10 pr-4 py-2.5 bg-card text-foreground rounded-lg border border-input focus:ring-2 focus:ring-ring focus:border-ring placeholder:text-muted-foreground"
            placeholder={placeholder}
            id="search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
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
                  onClick={() => onSelect({ id: 'new', title: search })}
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

const SingleItemButton = ({ page, search, onSelect }) => {
  return (
    <button
      onClick={() => onSelect(page)}
      className="flex items-center w-full px-4 py-3 text-foreground hover:bg-muted transition-colors"
      key={page.id}
    >
      <span className="flex-1 font-normal">
        {highlightText(page.title, search)}
      </span>
      {page.username !== 'NULL' && page.isPublic && (
        <span className="text-sm text-muted-foreground ml-2">
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
