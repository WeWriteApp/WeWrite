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
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PillLink } from "./PillLink";

const characterCount = 1;
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

const TypeaheadSearch = ({
  onSelect = null,
  setShowDropdown = null,
  userId = null,
}) => {
  const [search, setSearch] = useState("");
  const { user } = useContext(AuthContext);
  const [userPages, setUserPages] = useState([]);
  const [groupPages, setGroupPages] = useState([]);
  const [publicPages, setPublicPages] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchResults = useCallback(
    debounce(async (search, user) => {
      if (!user && !userId) return;

      console.log('TypeaheadSearch - Fetching results for:', {
        search,
        searchLength: search?.length,
        searchTrimmed: search?.trim(),
        searchTrimmedLength: search?.trim()?.length,
        userId: userId || user.uid,
        groups: user?.groups
      });

      setIsSearching(true);
      try {
        let selectedUserId = userId ? userId : user.uid;
        let groupIds = [];
        if (user && user.groups) {
          groupIds = Object.keys(user.groups);
        }

        const response = await fetch(
          `/api/search?userId=${selectedUserId}&searchTerm=${encodeURIComponent(search)}&groupIds=${groupIds}`
        );

        if (!response.ok) {
          console.error('Search API returned error:', response.status);
          const errorText = await response.text();
          console.error('Error details:', errorText);
          throw new Error(`Search API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('TypeaheadSearch API response:', data);
        setUserPages(data.userPages || []);
        setGroupPages(data.groupPages || []);
        setPublicPages(data.publicPages || []);
      } catch (error) {
        console.error("Error fetching search results", error);
        setUserPages([]);
        setGroupPages([]);
        setPublicPages([]);
      } finally {
        setIsSearching(false);
      }
    }, 500),
    []
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
    <div className="flex flex-col relative" id="typeahead-search">
      <div className="flex flex-col space-y-1">
        <input
          className="border border-gray-500 w-full p-2 text-lg bg-background text-text"
          placeholder="Search..."
          id="search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div
        className={`mt-4 shadow-xl p-4 bg-background--light rounded-lg border border-border absolute w-full top-8 transition-all ${
          search.length >= characterCount
            ? "opacity-100 z-50"
            : "opacity-0 -z-10"
        }
        `}
      >
        {isSearching && search.length >= characterCount ? (
          <Loader />
        ) : (
          <>
            {userPages.length > 0 && (
              <div>
                {search.length >= characterCount && (
                  <h3 className="text-xs text-gray-400">
                    {userId ? "" : "Your"}
                    Pages
                  </h3>
                )}
                {userPages.length === 0 && search.length >= characterCount ? (
                  <p className="text-xs text-gray-400">No user pages found.</p>
                ) : (
                  <ul className="space-y-1 mt-2">
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
                  </ul>
                )}
              </div>
            )}

            {groupPages.length > 0 && (
              <div className="mt-2 border-t border-border pt-2">
                {search.length >= characterCount && (
                  <h3 className="text-xs text-gray-400">From Groups</h3>
                )}
                {groupPages.length === 0 && search.length >= characterCount ? (
                  <p className="text-xs mt-2 text-gray-400">
                    No group pages found.
                  </p>
                ) : (
                  <ul className="space-y-1">
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
                  </ul>
                )}
              </div>
            )}

            {publicPages.length > 0 && (
              <div className="mt-2 border-t border-border pt-2">
                {search.length >= characterCount && (
                  <h3 className="text-xs text-gray-400">Public Pages</h3>
                )}
                {publicPages.length === 0 && search.length >= characterCount ? (
                  <p className="text-xs mt-2 text-gray-400">
                    No public pages found.
                  </p>
                ) : (
                  <ul className="space-y-1">
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
                  </ul>
                )}
              </div>
            )}
            {/* <div className="mt-2 border-t border-border pt-4 flex">
              <NewPageButton title={search} />
            </div> */}
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
      className="flex items-center justify-between w-full text-sm hover:bg-background p-1 rounded"
      key={page.id}
    >
      <span className="truncate">{highlightText(page.title, search)}</span>
      {page.username !== 'NULL' && page.isPublic && (
        <span className="text-xs text-gray-400 whitespace-nowrap">
          by {page.username}
        </span>
      )}
    </button>
  );
};

const NewPageButton = ({ title, redirect = true }) => {
  const { isMobile } = useContext(MobileContext);
  const router = useRouter();

  const handleNewPage = () => {
    alert("Creating new page with title: " + title);
    if (redirect) {
      // router.push('/pages/123');
    } else {
      //
    }
  };

  useEffect(() => {
    // monitor for cmd + enter
    const handleKeyDown = (e) => {
      if (e.key === "Enter" && e.metaKey) {
        handleNewPage();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
  return (
    <div className="flex flex-col">
      {isMobile && (
        <button onClick={handleNewPage} className="text-xs text-gray-400">
          Tap to create
        </button>
      )}
      {!isMobile && (
        <button className="text-xs text-gray-400">
          Press <span className="text-gray-500">cmd + enter</span> to create a
          new page
        </button>
      )}
    </div>
  );
};

const highlightText = (text, searchTerm) => {
  if (!searchTerm) return text;
  const parts = text.split(new RegExp(`(${searchTerm})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === searchTerm.toLowerCase() ? (
      <span key={index} className="bg-yellow-200 text-black">
        {part}
      </span>
    ) : (
      part
    )
  );
};

const Loader = () => {
  return (
    <div className="flex flex-col">
      <Icon
        icon="eos-icons:three-dots-loading"
        className="text-3xl text-gray-500"
      />
    </div>
  );
};

export default TypeaheadSearch;
