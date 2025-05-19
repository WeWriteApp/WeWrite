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
    console.log('Navigating to search page');
    // Use router.push with the correct path
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
        className="w-full px-4 py-2 pl-10 border border-input rounded-xl bg-background text-muted-foreground cursor-pointer transition-colors hover:border-primary focus:border-primary"
        onClick={navigateToSearchPage}
      >
        {placeholder}
      </div>

      {/* Search icon */}
      <div className="absolute inset-y-0 left-0 flex items-center pl-3">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Search button (positioned on the right) */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
        <div
          className="p-1 rounded-full bg-transparent group-hover:bg-primary/10 transition-colors cursor-pointer"
          onClick={navigateToSearchPage}
        >
          <Search className="h-5 w-5 text-foreground" />
        </div>
      </div>
    </div>
  );
};

export default SearchButton;
