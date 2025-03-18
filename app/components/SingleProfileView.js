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
import Button from "./Button";
import { useAuth } from "../providers/AuthProvider";
import { Loader } from "lucide-react";

const SingleProfileView = ({ profile }) => {
  const { user } = useAuth();
  const [pageCount, setPageCount] = useState(0);

  return (
    <ProfilePagesProvider userId={profile.uid}>
      <div className="p-2">
        <div className="flex items-center space-x-4 mb-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                width="24" 
                height="24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="h-4 w-4"
              >
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </Button>
          </Link>
          <h1 className="text-3xl font-semibold">{profile.username}</h1>
        </div>
        
        {!user && (
          <div className="bg-primary/10 text-primary border border-primary/20 rounded-md p-4 mb-4">
            <p>
              You are viewing this profile as a guest. 
              <Link href="/auth/login" className="ml-2 font-medium underline">
                Log in
              </Link> 
              to interact with {profile.username}'s pages.
            </p>
          </div>
        )}
        
        <div className="my-4">
          <TypeaheadSearch 
            userId={profile.uid} 
            placeholder={`Search ${profile.username}'s pages...`}
          />
        </div>
        <PagesList profile={profile} />
      </div>
    </ProfilePagesProvider>
  );
};

const PagesList = ({ profile }) => {
  const { user } = useAuth();
  const { pages, loading, loadMorePages, isMoreLoading, hasMorePages } =
    useContext(ProfilePagesContext);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="relative bg-background border-2 border-dashed border-white/20 rounded-[24px] p-8 max-w-md w-full text-center">
          <div className="flex flex-col items-center justify-center space-y-6">
            <Loader className="h-8 w-8 animate-spin text-primary" />
            <div className="text-text/60">Loading pages...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!pages || pages.length === 0) {
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
            href="/" 
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

  // Filter to only show public pages for non-authenticated users
  const visiblePages = user ? pages : pages.filter(page => page.isPublic);

  if (visiblePages.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <div className="relative bg-background border-2 border-dashed border-white/20 rounded-[24px] p-8 max-w-md w-full text-center">
          <div className="text-text text-xl mb-4">
            {profile.username} has no public pages.
          </div>
          <div className="text-text/60 mb-6">
            Log in to see more content.
          </div>
          <Link 
            href="/auth/login" 
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
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <ul className="space-x-1 flex flex-wrap">
        {visiblePages.map((page) => (
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

      {!user && pages.length !== visiblePages.length && (
        <div className="mt-4 p-3 bg-background border border-border rounded-md text-center">
          <p className="text-sm text-text/70">
            {pages.length - visiblePages.length} private pages are hidden.{" "}
            <Link href="/auth/login" className="text-primary underline">
              Log in
            </Link>{" "}
            to see all pages.
          </p>
        </div>
      )}

      <div className="flex flex-row justify-center">
        {/* Load more button - only show for authenticated users */}
        {user && hasMorePages && !isMoreLoading && (
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
