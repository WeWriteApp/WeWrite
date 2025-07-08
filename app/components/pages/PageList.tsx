"use client";

import React from "react";
import Link from "next/link";
import { FileText, ChevronRight, Plus, Search } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../ui/table";
import { interactiveCard, cn } from "../../lib/utils";
import { PillLink } from "../utils/PillLink";
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
export interface Page {
  id: string;
  title: string;
  isPublic: boolean;
  userId: string;
  authorName?: string;
  lastModified?: string;
  createdAt: string;
  groupId?: string;
  groupName?: string;
}

interface PageListProps {
  pages: Page[];
  mode?: "wrapped" | "table" | "grid";
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
}

const PageListSkeleton = ({ mode = "wrapped", count = 8 }) => {
  if (mode === "wrapped") {
    return (
      <div className="flex flex-wrap gap-2 justify-start items-start content-start">
        {Array(count).fill(0).map((_, index) => (
          <div key={`skeleton-${index}`} className="h-8 w-32 bg-muted rounded-full animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (mode === "grid") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array(count).fill(0).map((_, index) => (
          <div key={`skeleton-${index}`} className="h-24 bg-muted rounded-lg animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Array(count).fill(0).map((_, index) => (
        <div key={`skeleton-${index}`} className="h-16 bg-muted rounded-lg animate-pulse"></div>
      ))}
    </div>
  );
};

const DefaultEmptyState = ({ createButtonHref = "/new", createButtonText = "Create a page" }) => (
  <div className="flex justify-center">
    <div className="relative bg-background border-2 border-dashed border-border/40 rounded-[24px] p-8 max-w-md w-full text-center">
      <div className="text-foreground text-xl mb-4">
        No pages found
      </div>
      <div className="text-muted-foreground mb-6">
        Create your first page to start writing
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href={createButtonHref} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {createButtonText}
        </Link>
      </Button>
    </div>
  </div>
);

export default function PageList({
  pages,
  mode = "wrapped",
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
  groupId
}: PageListProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const { session } = useCurrentAccount();

  if (loading) {
    return <div style={{ minHeight: '200px' }}>
      <PageListSkeleton mode={mode} />
    </div>;
  }

  if (!pages || pages.length === 0) {
    return emptyState || <DefaultEmptyState createButtonHref={createButtonHref} createButtonText={createButtonText} />;
  }

  // Filter pages based on search term
  const filteredPages = searchTerm.trim() === ""
    ? pages
    : pages.filter(page =>
        page.title.toLowerCase().includes(searchTerm.toLowerCase())
      );

  // Limit the number of pages to display if maxItems is set
  const displayPages = maxItems ? filteredPages.slice(0, maxItems) : filteredPages;

  // Adjust create button href if groupId is provided
  const finalCreateButtonHref = groupId
    ? `${createButtonHref}${createButtonHref.includes('?') ? '&' : '?'}groupId=${groupId}`
    : createButtonHref;

  return (
    <div className="space-y-4">
      {/* Header with search and create button */}
      {(showSearch || showCreateButton) && (
        <div className="flex flex-col sm:flex-row justify-between gap-3 mb-4">
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

          {showCreateButton && (
            <Button variant="outline" asChild>
              <Link href={finalCreateButtonHref} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {createButtonText}
              </Link>
            </Button>
          )}
        </div>
      )}

      {/* Wrapped mode (pill links) */}
      {mode === "wrapped" && (
        <div className="relative">
          <div className="flex flex-wrap gap-2 justify-start items-start content-start">
            {displayPages.map((page) => (
              <div key={page.id} className="flex-none max-w-full">
                <PillLink
                  href={`/${page.id}`}
                  isPublic={page.isPublic}
                  byline={page.authorName}
                  className="max-w-[200px] sm:max-w-[250px] md:max-w-[300px]"
                  isOwned={page.userId === session?.uid}
                  isLoading={false}
                  label=""
                >
                  {page.title}
                </PillLink>
              </div>
            ))}
          </div>
          {/* Gradient overlay that shows 2 full lines and covers the 3rd line */}
          <div className="absolute bottom-0 left-0 right-0 h-[calc(1.5rem+4px)] bg-gradient-to-t from-background to-transparent pointer-events-none" />
        </div>
      )}

      {/* Table mode */}
      {mode === "table" && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayPages.map((page) => (
                <TableRow key={page.id}>
                  <TableCell className="font-medium">{page.title}</TableCell>
                  <TableCell>
                    <Badge variant="default" className="flex items-center w-fit gap-1">
                      <span>Published</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(page.lastModified || page.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/${page.id}`}>
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Grid mode (card style) */}
      {mode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayPages.map((page) => (
            <Link key={page.id} href={`/${page.id}`} className={cn(
              interactiveCard("h-full"),
              "transition-all duration-200"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full",
                  "bg-primary/10 text-primary"
                )}>
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-grow">
                  <h3 className="font-medium truncate hyphens-none">{page.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {new Date(page.lastModified || page.createdAt).toLocaleDateString()}
                    </span>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <span>Published</span>
                    </Badge>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* View all button */}
      {showViewAll && pages.length > 0 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline" size="sm" asChild>
            <Link href={viewAllHref}>{viewAllText}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}