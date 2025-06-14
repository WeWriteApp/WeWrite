"use client";
import React from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * SearchButton component that looks like a search input but acts as a button
 * that navigates to the search page when clicked.
 */
const SearchButton = ({ placeholder = "Search all pages...", className = "" }) => {
  const router = useRouter();

  const navigateToSearchPage = () => {
    router.push('/search');
  };

  return (
    <div
      onClick={navigateToSearchPage}
      className={`relative w-full cursor-pointer group ${className}`}
      role="button"
      aria-label="Go to search page"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          navigateToSearchPage();
        }
      }}
    >
      {/* Search input (non-functional, just for appearance) */}
      <div
        className="w-full px-4 py-2 pl-10 border border-input rounded-2xl bg-background text-muted-foreground cursor-pointer transition-colors hover:border-primary focus:border-primary overflow-hidden"
        onClick={navigateToSearchPage}
      >
        {placeholder}
      </div>

      {/* Search icon */}
      <div className="absolute inset-y-0 left-0 flex items-center pl-3">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
    </div>
  );
};

export default SearchButton;
