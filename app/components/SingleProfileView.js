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
import { ChevronLeft } from "lucide-react";
import Button from "./Button";

const SingleProfileView = ({ profile }) => {
  const [pageCount, setPageCount] = useState(0);

  return (
    <ProfilePagesProvider userId={profile.uid}>
      <div className="p-2">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-semibold">{profile.username}</h1>
        <div className="my-4">
          <TypeaheadSearch userId={profile.uid} />
        </div>
        <PagesList profile={profile} />
      </div>
    </ProfilePagesProvider>
  );
};

const PagesList = ({ profile }) => {
  const { pages, loading, loadMorePages, isMoreLoading, hasMorePages } =
    useContext(ProfilePagesContext);

  if (!pages) return null;

  if (pages.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <div className="relative bg-background border-2 border-dashed border-white/20 rounded-[24px] p-8 max-w-md w-full text-center">
          <div className="text-text text-xl mb-4">
            {profile.username} hasn't written any pages yet.
          </div>
          <div className="text-text/60 mb-6">
            Check back later!
          </div>
          <Link 
            href="/pages" 
            className="
              inline-block
              bg-[#0057FF]
              text-white text-sm font-medium
              px-6 py-2.5
              rounded-full
              hover:bg-[#0046CC]
              transition-colors duration-200
              shadow-[0_0_12px_rgba(0,87,255,0.4)]
            "
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

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
