// a page to display a user profile
//
"use client";
import React, { useState, useEffect } from "react";
import { PillLink } from "./PillLink";
import Link from "next/link";
import { ReactSearchAutocomplete } from "react-search-autocomplete";
import { useRouter } from "next/navigation";

const SingleProfileView = ({ profile }) => {
  const [searchItems, setSearchItems] = useState([]);
  const [pages, setPages] = useState([]);
  const [pageCount, setPageCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (profile) {
      if (profile.pages) {
        let arr = [];
        let searchArr = [];
        Object.keys(profile.pages).forEach((key) => {
          if (profile.pages[key].isPublic) {
            arr.push({
              id: key,
              ...profile.pages[key],
            });

            searchArr.push({
              id: key,
              name: profile.pages[key].title,
              isPublic: profile.pages[key].isPublic,
            });
          }
        });
        setPages(arr);
        setSearchItems(searchArr);
        setPageCount(arr.length);
      }
    }
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
            {pages.map((page, index) => (
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
