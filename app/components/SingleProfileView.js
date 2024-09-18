"use client";
import React, { useState, useEffect } from "react";
import { PillLink } from "./PillLink";
import Link from "next/link";
import { ReactSearchAutocomplete } from "react-search-autocomplete";
import { useRouter } from "next/navigation";
import { db } from "../firebase/database";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";

const SingleProfileView = ({ profile }) => {
  const [searchItems, setSearchItems] = useState([]);
  const [pages, setPages] = useState([]);
  const [pageCount, setPageCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    let unsubscribe = () => {};

    if (profile) {
      const pagesQuery = query(
        collection(db, "pages"),
        where("userId", "==", profile.uid), // Profile's user ID
        orderBy("lastModified", "desc") // Order by last modified
      );

      unsubscribe = onSnapshot(pagesQuery, (snapshot) => {
        const fetchedPages = [];
        const fetchedSearchItems = [];

        snapshot.forEach((doc) => {
          const pageData = {
            id: doc.id,
            ...doc.data(),
          };

          fetchedPages.push(pageData);
          fetchedSearchItems.push({
            id: doc.id,
            name: pageData.title,
            isPublic: pageData.isPublic,
          });
        });

        setPages(fetchedPages);
        setSearchItems(fetchedSearchItems);
        // count public pages
        const publicPages = fetchedPages.filter((page) => page.isPublic);
        setPageCount(publicPages.length);
      });
    }

    return () => unsubscribe(); // Clean up the listener when the component unmounts
  }, [profile]);

  return (
    <div className="p-2">
      <Link href="/pages">Back</Link>
      <h1 className="text-3xl font-semibold">{profile.username}</h1>
      {pages.length > 0 && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold">Public Pages - {pageCount}</h2>

          <Search pages={searchItems} router={router} />
          <ul className="space-x-1 flex flex-wrap">
            {pages.map((page) => (
              <li key={page.id}>
                <PillLink
                  groupId={page.groupId}
                  href={`/pages/${page.id}`}
                  isPublic={page.isPublic}
                >
                  {page.title}
                </PillLink>
              </li>
            ))}
          </ul>
        </div>
      )}
      {pages.length === 0 && (
        <div>
          <p>This user has no public pages.</p>
        </div>
      )}
    </div>
  );
};

const Search = ({ pages, router }) => {
  const handleOnSearch = (string, results) => {};

  const handleOnSelect = (item) => {
    router.push(`/pages/${item.id}`);
  };

  return (
    <div className="py-4 w-full">
      <ReactSearchAutocomplete
        items={pages}
        onSearch={handleOnSearch}
        onSelect={handleOnSelect}
        autoFocus
        className="searchbar"
        placeholder="Search for a page..."
        fuseOptions={{
          minMatchCharLength: 2,
        }}
        formatResult={(item) => {
          return (
            <PillLink
              groupId={item.groupId}
              href={`/pages/${item.id}`}
              isPublic={item.isPublic}
              key={item.id}
            >
              {item.name}
            </PillLink>
          );
        }}
      />
    </div>
  );
};

export default SingleProfileView;
