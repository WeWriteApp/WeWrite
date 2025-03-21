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
import { useAuth } from "../providers/AuthProvider";
import { Loader, Settings, ChevronLeft } from "lucide-react";
import { Button } from "./ui/button";

const SingleProfileView = ({ profile }) => {
  const { user } = useAuth();
  const router = useRouter();
  const [pageCount, setPageCount] = useState(0);
  
  // Check if this profile belongs to the current user
  const isCurrentUser = user && user.uid === profile.uid;

  return (
    <ProfilePagesProvider userId={profile.uid}>
      <div className="p-2">
        <div className="flex items-center mb-4">
          <div className="flex-1">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          {/* Centered title */}
          <div className="flex items-center justify-center">
            <h1 className="text-3xl font-semibold">{profile.username}</h1>
          </div>
          
          {/* Settings button - only visible for current user */}
          <div className="flex-1 flex justify-end">
            {isCurrentUser && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-full hover:bg-[rgba(255,255,255,0.1)]"
                onClick={() => router.push('/account')}
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}
            {!isCurrentUser && <div className="w-8" />}
          </div>
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
  const { 
    pages, 
    privatePages,
    loading, 
    loadMorePages, 
    isMoreLoading, 
    isMorePrivateLoading,
    hasMorePages,
    hasMorePrivatePages,
    activeTab,
    setActiveTab
  } = useContext(ProfilePagesContext);
  
  const isCurrentUser = user && user.uid === profile.uid;

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

  // Only show public pages to non-owners
  const visiblePages = isCurrentUser ? (activeTab === 'public' ? pages : privatePages) : pages;
  const totalPages = isCurrentUser ? pages.length + privatePages.length : pages.length;

  if (totalPages === 0) {
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

  if (!isCurrentUser && visiblePages.length === 0) {
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

  if (isCurrentUser && activeTab === 'private' && privatePages.length === 0) {
    return (
      <>
        {/* Tabs */}
        <div className="flex border-b mb-4">
          <button
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'public' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('public')}
          >
            Public Pages
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'private' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('private')}
          >
            Private Pages
          </button>
        </div>
        
        <div className="flex justify-center py-8">
          <div className="relative bg-background border-2 border-dashed border-white/20 rounded-[24px] p-8 max-w-md w-full text-center">
            <div className="text-text text-xl mb-4">
              You don't have any private pages.
            </div>
            <div className="text-text/60 mb-6">
              Create a private page to get started.
            </div>
            <Link 
              href="/new" 
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
              Create a page
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Show tabs only for the current user */}
      {isCurrentUser && (
        <div className="flex border-b mb-4">
          <button
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'public' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('public')}
          >
            Public Pages
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'private' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('private')}
          >
            Private Pages
          </button>
        </div>
      )}
      
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

      <div className="flex flex-row justify-center">
        {/* Load more button */}
        {hasMorePages && activeTab === 'public' && !isMoreLoading && (
          <Button onClick={loadMorePages} variant="outline" className="mt-4">
            Load More Pages
          </Button>
        )}
        
        {/* Load more private pages button */}
        {isCurrentUser && hasMorePrivatePages && activeTab === 'private' && !isMorePrivateLoading && (
          <Button onClick={loadMorePages} variant="outline" className="mt-4">
            Load More Private Pages
          </Button>
        )}

        {isMoreLoading && (
          <div className="mt-4 flex items-center gap-2">
            <Loader className="h-4 w-4 animate-spin" />
            <span>Loading more...</span>
          </div>
        )}
      </div>
    </>
  );
};

export default SingleProfileView;
