"use client";
import React, { useContext, useState, useEffect } from "react";
import { PillLink } from "./PillLink";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataContext } from "../providers/DataProvider";
import TypeaheadSearch from "./TypeaheadSearch";
import {
  ProfilePagesProvider,
  ProfilePagesContext,
} from "../providers/ProfilePageProvider";

const SingleProfileView = ({ profile }) => {
  const [pageCount, setPageCount] = useState(0);

  return (
    <ProfilePagesProvider userId={profile.uid}>
      <div className="p-2">
        <Link href="/pages">Back</Link>
        <h1 className="text-3xl font-semibold">{profile.username}</h1>
          <div className="my-4">
            <TypeaheadSearch userId={profile.uid} />
          </div>
          <PagesList />
      </div>
    </ProfilePagesProvider>
  );
};

const PagesList = () => {
  const { pages, loading, loadMorePages, isMoreLoading, hasMorePages } =
    useContext(ProfilePagesContext); // Use context for data

  if (!pages) return null;
  return (
    <>
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

        <div className="flex flex-row justify-center">
      {/* Load more button */}
      {hasMorePages && !isMoreLoading && (
        <button onClick={loadMorePages} className="mt-4 bg-background text-text border border-border p-2 mx-auto">
          Load More Pages
        </button>
      )}

      {isMoreLoading && <p>Loading more...</p>}
      </div>
    </>
  );
};

export default SingleProfileView;
