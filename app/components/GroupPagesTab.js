"use client";
import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Plus, FileText, Clock, Loader, Search, SortAsc, SortDesc, Filter } from "lucide-react";
import Link from "next/link";
import { rtdb } from "../firebase/rtdb";
import { ref, get } from "firebase/database";
import { Input } from "./ui/input";
import { PillLink } from "./PillLink";
import AddExistingPageDialog from "./AddExistingPageDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "./ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "./ui/table";

export default function GroupPagesTab({ group, isOwner, isMember }) {
  const [pages, setPages] = useState([]);
  const [filteredPages, setFilteredPages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("lastModified");
  const [sortDirection, setSortDirection] = useState("desc");
  const [viewMode, setViewMode] = useState("grid"); // grid or table
  const [refreshKey, setRefreshKey] = useState(0);

  // Load pages from the group
  useEffect(() => {
    const fetchPages = async () => {
      try {
        setIsLoading(true);

        if (!group.pages) {
          setPages([]);
          setFilteredPages([]);
          setIsLoading(false);
          return;
        }

        // Transform group pages into a more usable format
        const pagesArray = await Promise.all(
          Object.entries(group.pages).map(async ([pageId, pageData]) => {
            // If we only have the ID, fetch the full page data
            if (typeof pageData === 'boolean') {
              try {
                const pageRef = ref(rtdb, `pages/${pageId}`);
                const snapshot = await get(pageRef);

                if (snapshot.exists()) {
                  return {
                    id: pageId,
                    ...snapshot.val(),
                    groupId: group.id
                  };
                }
                return null;
              } catch (err) {
                console.error(`Error fetching page ${pageId}:`, err);
                return null;
              }
            } else {
              // We already have the page data
              return {
                id: pageId,
                ...pageData,
                groupId: group.id
              };
            }
          })
        );

        // Filter out null values (pages that couldn't be fetched)
        const validPages = pagesArray.filter(page => page !== null);
        setPages(validPages);
        setFilteredPages(validPages);
      } catch (err) {
        console.error("Error fetching group pages:", err);
        setError("Failed to load group pages. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPages();
  }, [group.id, group.pages, refreshKey]);

  // Filter and sort pages when search term or sort options change
  useEffect(() => {
    if (!pages.length) return;

    let filtered = [...pages];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(page =>
        (page.title && page.title.toLowerCase().includes(term)) ||
        (page.username && page.username.toLowerCase().includes(term))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle dates
      if (sortField === 'lastModified' || sortField === 'createdAt') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      // Handle strings
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
      }
      if (typeof bValue === 'string') {
        bValue = bValue.toLowerCase();
      }

      // Sort direction
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredPages(filtered);
  }, [pages, searchTerm, sortField, sortDirection]);

  // Handle pages added
  const handlePagesAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl font-semibold">Group Pages</h2>

        {(isOwner || isMember) && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/new?groupId=${group.id}`} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Page
              </Link>
            </Button>
            <AddExistingPageDialog
              groupId={group.id}
              onPagesAdded={handlePagesAdded}
            />
          </div>
        )}
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative w-full sm:w-auto flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pages..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 self-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <SortAsc className="h-4 w-4" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => { setSortField('title'); setSortDirection('asc'); }}
                className={sortField === 'title' && sortDirection === 'asc' ? 'bg-muted' : ''}
              >
                Title (A-Z)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { setSortField('title'); setSortDirection('desc'); }}
                className={sortField === 'title' && sortDirection === 'desc' ? 'bg-muted' : ''}
              >
                Title (Z-A)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { setSortField('lastModified'); setSortDirection('desc'); }}
                className={sortField === 'lastModified' && sortDirection === 'desc' ? 'bg-muted' : ''}
              >
                Recently Updated
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { setSortField('lastModified'); setSortDirection('asc'); }}
                className={sortField === 'lastModified' && sortDirection === 'asc' ? 'bg-muted' : ''}
              >
                Oldest Updated
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { setSortField('createdAt'); setSortDirection('desc'); }}
                className={sortField === 'createdAt' && sortDirection === 'desc' ? 'bg-muted' : ''}
              >
                Newest Created
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { setSortField('createdAt'); setSortDirection('asc'); }}
                className={sortField === 'createdAt' && sortDirection === 'asc' ? 'bg-muted' : ''}
              >
                Oldest Created
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Filter className="h-4 w-4" />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-muted' : ''}
              >
                Grid View
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setViewMode('table')}
                className={viewMode === 'table' ? 'bg-muted' : ''}
              >
                Table View
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Pages list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="mb-2">{error}</p>
          <Button variant="outline" onClick={() => setRefreshKey(prev => prev + 1)}>
            Try Again
          </Button>
        </div>
      ) : filteredPages.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No pages found</p>
          {(isOwner || isMember) && searchTerm === "" && (
            <div className="flex gap-2 justify-center mt-4">
              <Button variant="outline" asChild>
                <Link href={`/new?groupId=${group.id}`}>Create your first page</Link>
              </Button>
            </div>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filteredPages.map(page => (
            <div key={page.id} className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors">
              <div className="mb-2">
                <PillLink
                  href={`/${page.id}`}
                  isPublic={page.isPublic}
                >
                  {page.title || "Untitled"}
                </PillLink>
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>{page.username || "Anonymous"}</span>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(page.lastModified)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPages.map(page => (
                <TableRow key={page.id}>
                  <TableCell>
                    <PillLink
                      href={`/${page.id}`}
                      isPublic={page.isPublic}
                    >
                      {page.title || "Untitled"}
                    </PillLink>
                  </TableCell>
                  <TableCell>{page.username || "Anonymous"}</TableCell>
                  <TableCell>{formatDate(page.createdAt)}</TableCell>
                  <TableCell>{formatDate(page.lastModified)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
