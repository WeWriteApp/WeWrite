"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, Lock, Globe, ChevronRight, Plus, Search, Eye, DollarSign, Clock, ArrowDownAZ, ArrowUpAZ, CalendarDays, SortAsc, SortDesc } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "./ui/table";
import { interactiveCard, cn } from "../lib/utils";
import { PillLink } from "./PillLink";
import FollowButton from "./FollowButton";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from './ui/dropdown-menu';

export interface Page {
  id: string;
  title: string;
  isPublic: boolean;
  userId: string;
  authorName?: string;
  lastModified?: string;
  createdAt: string;
  groupId?: string;
  viewCount?: number;
  followerCount?: number;
  donorCount?: number;
}

interface PageListViewProps {
  pages: Page[];
  viewStyle?: "wrapped" | "stacked";
  showSearch?: boolean;
  emptyState?: React.ReactNode;
  loading?: boolean;
  showCreateButton?: boolean;
  createButtonHref?: string;
  createButtonText?: string;
  maxItems?: number;
  showViewAll?: boolean;
  viewAllHref?: string;
  viewAllText?: string;
  groupId?: string;
  showFollowButtons?: boolean;
  isCurrentUser?: boolean;
}

// Default empty state component
function DefaultEmptyState({ createButtonHref, createButtonText }: { createButtonHref: string, createButtonText: string }) {
  return (
    <div className="text-center py-8 border border-dashed rounded-lg bg-muted/30">
      <div className="flex flex-col items-center justify-center gap-2">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <h3 className="text-lg font-medium">No pages found</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          There are no pages to display. Create a new page to get started.
        </p>
        <Button variant="outline" asChild className="mt-2">
          <Link href={createButtonHref} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {createButtonText}
          </Link>
        </Button>
      </div>
    </div>
  );
}

// Loading skeleton
function PageListSkeleton({ viewStyle }: { viewStyle: "wrapped" | "stacked" }) {
  return (
    <div className="animate-pulse">
      {viewStyle === "wrapped" ? (
        <div className="flex flex-wrap gap-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-8 w-32 bg-muted rounded-full"></div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="w-2/3 h-6 bg-muted rounded"></div>
              <div className="w-20 h-6 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PageListView({
  pages,
  viewStyle = "wrapped",
  showSearch = false,
  emptyState,
  loading = false,
  showCreateButton = false,
  createButtonHref = "/new",
  createButtonText = "New page",
  maxItems,
  showViewAll = false,
  viewAllHref = "/",
  viewAllText = "View all",
  groupId,
  showFollowButtons = false,
  isCurrentUser = false
}: PageListViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("newest");
  const [sortedPages, setSortedPages] = useState<Page[]>([]);

  // Sort options
  const sortOptions = [
    { id: 'newest', label: 'Newest', icon: Clock },
    { id: 'oldest', label: 'Oldest', icon: CalendarDays },
    { id: 'recently_edited', label: 'Recently Edited', icon: Clock },
    { id: 'most_views', label: 'Most Views', icon: Eye },
    { id: 'most_followers', label: 'Most Followers', icon: User },
    { id: 'most_donors', label: 'Most Donors', icon: DollarSign },
    { id: 'alpha_asc', label: 'A-Z', icon: ArrowDownAZ },
    { id: 'alpha_desc', label: 'Z-A', icon: ArrowUpAZ },
  ];

  // Apply sorting and filtering
  useEffect(() => {
    if (!pages || pages.length === 0) {
      setSortedPages([]);
      return;
    }

    // Filter pages based on search term
    const filteredPages = searchTerm.trim() === ""
      ? [...pages]
      : pages.filter(page =>
          page.title.toLowerCase().includes(searchTerm.toLowerCase())
        );

    // Apply sorting based on the selected option
    const sorted = [...filteredPages];
    
    switch (sortOption) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        break;
      case 'oldest':
        sorted.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        break;
      case 'recently_edited':
        sorted.sort((a, b) => new Date(b.lastModified || 0).getTime() - new Date(a.lastModified || 0).getTime());
        break;
      case 'most_views':
        sorted.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        break;
      case 'most_followers':
        sorted.sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0));
        break;
      case 'most_donors':
        sorted.sort((a, b) => (b.donorCount || 0) - (a.donorCount || 0));
        break;
      case 'alpha_asc':
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'alpha_desc':
        sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        break;
      default:
        sorted.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }

    setSortedPages(sorted);
  }, [pages, searchTerm, sortOption]);

  if (loading) {
    return <PageListSkeleton viewStyle={viewStyle} />;
  }

  if (!pages || pages.length === 0) {
    return emptyState || <DefaultEmptyState createButtonHref={createButtonHref} createButtonText={createButtonText} />;
  }

  // Limit the number of pages to display if maxItems is specified
  const displayPages = maxItems ? sortedPages.slice(0, maxItems) : sortedPages;

  // Determine the final create button href (with group ID if provided)
  const finalCreateButtonHref = groupId ? `${createButtonHref}?groupId=${groupId}` : createButtonHref;

  // Get the current sort option
  const currentOption = sortOptions.find(option => option.id === sortOption) || sortOptions[0];
  const Icon = currentOption.icon;

  return (
    <div className="space-y-4">
      {/* Header with search, sort, and create button */}
      <div className="flex flex-col sm:flex-row justify-between gap-3 mb-4">
        <div className="flex flex-1 gap-2">
          {showSearch && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search pages..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
          
          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{currentOption.label}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Sort Pages</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={sortOption} onValueChange={setSortOption}>
                {sortOptions.map((option) => {
                  const OptionIcon = option.icon;
                  return (
                    <DropdownMenuRadioItem key={option.id} value={option.id} className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <OptionIcon className="h-4 w-4" />
                        <span>{option.label}</span>
                      </div>
                    </DropdownMenuRadioItem>
                  );
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* View style toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <span className="hidden sm:inline">View</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>View Style</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={viewStyle} onValueChange={(value) => setViewStyle(value as "wrapped" | "stacked")}>
                <DropdownMenuRadioItem value="wrapped" className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="9" y1="3" x2="9" y2="21" />
                        <line x1="15" y1="3" x2="15" y2="21" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="3" y1="15" x2="21" y2="15" />
                      </svg>
                    </div>
                    <span>Wrapped</span>
                  </div>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="stacked" className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                      </svg>
                    </div>
                    <span>Stacked</span>
                  </div>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex gap-2">
          {showCreateButton && (
            <Button variant="outline" asChild>
              <Link href={finalCreateButtonHref} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {createButtonText}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Wrapped mode (pill links) */}
      {viewStyle === "wrapped" && (
        <div className="relative">
          <div className="flex flex-wrap gap-2 justify-start items-start content-start">
            {displayPages.map((page) => (
              <div key={page.id} className="flex-none max-w-full">
                <PillLink
                  groupId={page.groupId}
                  href={`/${page.id}`}
                  isPublic={page.isPublic}
                  byline={page.authorName}
                  className="max-w-[200px] sm:max-w-[250px] md:max-w-[300px]"
                  isOwned={isCurrentUser}
                  isLoading={false}
                  label=""
                >
                  {page.title}
                </PillLink>
              </div>
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        </div>
      )}

      {/* Stacked mode */}
      {viewStyle === "stacked" && (
        <div className="space-y-2">
          {displayPages.map((page) => (
            <div key={page.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/10 transition-colors">
              <Link href={`/${page.id}`} className="flex-1 flex items-center gap-3">
                <div className={cn(
                  "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full",
                  "bg-primary/10 text-primary"
                )}>
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium truncate">{page.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {new Date(page.lastModified || page.createdAt).toLocaleDateString()}
                    </span>
                    <Badge variant={page.isPublic ? "default" : "outline"} className="flex items-center w-fit gap-1 text-xs">
                      {page.isPublic ? (
                        <>
                          <Globe className="h-3 w-3" />
                          <span>Public</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-3 w-3" />
                          <span>Private</span>
                        </>
                      )}
                    </Badge>
                    {page.viewCount !== undefined && (
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {page.viewCount}
                      </span>
                    )}
                    {page.followerCount !== undefined && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {page.followerCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
              
              {showFollowButtons && !isCurrentUser && (
                <div className="ml-2">
                  <FollowButton pageId={page.id} pageTitle={page.title} pageOwnerId={page.userId} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* View all link */}
      {showViewAll && displayPages.length > 0 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline" asChild>
            <Link href={viewAllHref} className="flex items-center gap-2">
              {viewAllText}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
