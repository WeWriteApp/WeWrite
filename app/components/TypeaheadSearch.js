"use client";
import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../providers/AuthProvider";
import { MobileContext } from "../providers/MobileProvider";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const TypeaheadSearch = () => {
  const [search, setSearch] = useState("");
  const { user } = useContext(AuthContext);
  const [userPages, setUserPages] = useState([]);
  const [groupPages, setGroupPages] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!search) {
      setUserPages([]);
      setGroupPages([]);
      return;
    }
    if (!user) return;

    // if search less than 3 characters, don't make request
    if (search.length < 3 || search === "") {
      setUserPages([]);
      setGroupPages([]);
      return;
    }
    const fetchResults = async () => {
      setIsSearching(true);

      try {

        let groupIds = [];
        if (user.groups) {
          groupIds = Object.keys(user.groups);
        }

        const response = await fetch(
          `/api/search?userId=${user.uid}&searchTerm=${search}&groupIds=${groupIds}`
        );
        const data = await response.json();
        console.log(data);
        setUserPages(data.userPages);
        setGroupPages(data.groupPages);
        setIsSearching(false);
      } catch (error) {
        console.error("Error fetching search results", error);
        setIsSearching(false);
      }
    };
    fetchResults();
  }, [search,user]);

  if (!user) return null;
  return (
    <div className="flex flex-col relative">
      <div className="flex flex-col space-y-1">
        <input
          className="border border-gray-500 w-full p-2 text-lg bg-background text-text"
          placeholder="Search..."
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <pre className="mt-2 text-xs text-gray-500">
          Please search with at least 3 characters
        </pre>
      </div>

      <div
        className={`mt-4 shadow-xl p-4 bg-background--light rounded-lg border border-border absolute w-full top-16 transition-all ${
          search.length >= 3 ? "opacity-100 z-50" : "opacity-0 -z-10"
        }
        `}
      >
        {isSearching && search.length >= 3 ? (
          <Loader />
        ) : (
          <>
            <div>
              {search.length >= 3 && (
                <h3 className="text-xs text-gray-400">Your Pages</h3>
              )}
              {userPages.length === 0 && search.length >= 3 ? (
                <p className="text-xs text-gray-400">No user pages found.</p>
              ) : (
                <ul className="space-y-1 mt-2">
                  {userPages.map((page) => (
                    <Link
                      href={`/pages/${page.id}`}
                      className="flex items-center space-x-2 text-sm"
                      key={page.id}
                    >
                      <p className="text-sm">
                        {highlightText(page.title, search)} -{" "}
                        <span className="text-xs text-gray-400">
                          {new Date(page.updated_at).toLocaleDateString() +
                            " " +
                            new Date(page.updated_at).toLocaleTimeString()}
                        </span>
                      </p>
                    </Link>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-2 border-t border-border pt-2">
              {search.length >= 3 && (
                <h3 className="text-xs text-gray-400">From Groups</h3>
              )}
              {groupPages.length === 0 && search.length >= 3 ? (
                <p
                  className="text-xs mt-2
                text-gray-400
                "
                >
                  No group pages found.
                </p>
              ) : (
                <ul className="space-y-1">
                  {groupPages.map((page) => (
                    <Link
                      href={`/pages/${page.id}`}
                      className="flex items-center space-x-2 text-sm hover:bg-background p-1"
                      key={page.id}
                    >
                      <p className="text-sm text-text">
                        {highlightText(page.title, search)} -{" "}
                        <span className="text-xs text-gray-400">
                          {new Date(page.updated_at).toLocaleDateString() +
                            " " +
                            new Date(page.updated_at).toLocaleTimeString()}
                        </span>
                      </p>
                    </Link>
                  ))}
                </ul>
              )}
            </div>
            {/* <div className="mt-2 border-t border-border pt-4 flex">
              <NewPageButton title={search} />
            </div> */}
          </>
        )}
      </div>
    </div>
  );
};

const NewPageButton = ({
  title,
  redirect = true,
}) => {
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
        <button 
          onClick={handleNewPage}
        className="text-xs text-gray-400">Tap to create</button>
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