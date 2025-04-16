"use client";

import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthContext } from '../providers/AuthProvider';
import { PillLink } from '../components/PillLink';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Copy, Link as LinkIcon, Search } from 'lucide-react';
// import { useToast } from '../components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Skeleton } from '../components/ui/skeleton';
import Link from 'next/link';
import SearchRecommendations from '../components/SearchRecommendations';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const { user } = useContext(AuthContext);
  // const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ pages: [], users: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Initialize query from URL parameters
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      performSearch(q);
    }
  }, [searchParams]);

  // Perform search when query changes
  const performSearch = async (searchTerm) => {
    if (!searchTerm || !user) return;

    setIsLoading(true);
    try {
      let groupIds = [];
      if (user.groups) {
        groupIds = Object.keys(user.groups);
      }

      const queryUrl = `/api/search?userId=${user.uid}&searchTerm=${encodeURIComponent(searchTerm)}&groupIds=${groupIds}`;
      console.log('Making API request to:', queryUrl);

      const response = await fetch(queryUrl);

      if (!response.ok) {
        console.error('Search API returned error:', response.status);
        throw new Error(`Search API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Search results:', data);

      setResults({
        pages: data.pages || [],
        users: data.users || []
      });
    } catch (error) {
      console.error('Error searching:', error);
      console.error("Search Error: There was a problem performing your search.");
      // toast({
      //   title: "Search Error",
      //   description: "There was a problem performing your search. Please try again.",
      //   variant: "destructive"
      // });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search form submission
  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      // Update URL with search query
      const url = new URL(window.location);
      url.searchParams.set('q', query);
      window.history.pushState({}, '', url);

      performSearch(query);
    }
  };

  // Copy search URL to clipboard
  const copySearchUrl = () => {
    const url = new URL(window.location);
    navigator.clipboard.writeText(url.toString())
      .then(() => {
        console.log("Link copied to clipboard");
        // toast({
        //   title: "Link Copied",
        //   description: "Search URL copied to clipboard",
        // });
      })
      .catch(err => {
        console.error('Failed to copy URL:', err);
        console.error("Could not copy the URL to clipboard");
        // toast({
        //   title: "Copy Failed",
        //   description: "Could not copy the URL to clipboard",
        //   variant: "destructive"
        // });
      });
  };

  // Filter results based on active tab
  const filteredResults = () => {
    if (activeTab === 'all') {
      return {
        pages: results.pages,
        users: results.users
      };
    } else if (activeTab === 'pages') {
      return {
        pages: results.pages,
        users: []
      };
    } else if (activeTab === 'users') {
      return {
        pages: [],
        users: results.users
      };
    }
    return { pages: [], users: [] };
  };

  const filtered = filteredResults();
  const totalResults = filtered.pages.length + filtered.users.length;

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Search</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={copySearchUrl}
          className="flex items-center gap-2"
        >
          <LinkIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Copy Link</span>
        </Button>
      </div>

      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Search for pages, users..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit">Search</Button>
        </div>
      </form>

      {/* Show recommendations when there's no query */}
      {!query && (
        <SearchRecommendations
          onSelect={(recommendation) => {
            setQuery(recommendation);
            performSearch(recommendation);
            // Update URL with search query
            const url = new URL(window.location);
            url.searchParams.set('q', recommendation);
            window.history.pushState({}, '', url);
          }}
        />
      )}

      {query && (
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Searching..."
              : `Found ${totalResults} results for "${query}"`}
          </p>
        </div>
      )}

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">
            All ({results.pages.length + results.users.length})
          </TabsTrigger>
          <TabsTrigger value="pages">
            Pages ({results.pages.length})
          </TabsTrigger>
          <TabsTrigger value="users">
            Users ({results.users.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {filtered.users.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-3">Users</h2>
                  <div className="space-y-2">
                    {filtered.users.map(user => (
                      <div key={user.id} className="flex items-center">
                        <div className="flex-none max-w-[60%]">
                          <PillLink href={`/u/${user.id}`} className="max-w-full">
                            {user.username}
                          </PillLink>
                        </div>
                        <span className="text-xs text-muted-foreground ml-2 truncate">
                          User
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filtered.pages.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-3">Pages</h2>
                  <div className="space-y-2">
                    {filtered.pages.map(page => (
                      <div key={page.id} className="flex items-center">
                        <div className="flex-none max-w-[60%]">
                          <PillLink href={`/${page.id}`} className="max-w-full">
                            {page.title}
                          </PillLink>
                        </div>
                        <span className="text-xs text-muted-foreground ml-2 truncate">
                          by {page.username || "Anonymous"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {totalResults === 0 && query && !isLoading && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No results found for "{query}"</p>
                  <Button asChild>
                    <Link href={`/new?title=${encodeURIComponent(query)}`}>
                      Create "{query}" page
                    </Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="pages">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-[300px]" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {filtered.pages.length > 0 ? (
                <div className="space-y-2">
                  {filtered.pages.map(page => (
                    <div key={page.id} className="flex items-center">
                      <div className="flex-none max-w-[60%]">
                        <PillLink href={`/${page.id}`} className="max-w-full">
                          {page.title}
                        </PillLink>
                      </div>
                      <span className="text-xs text-muted-foreground ml-2 truncate">
                        by {page.username || "Anonymous"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No pages found for "{query}"</p>
                  <Button asChild>
                    <Link href={`/new?title=${encodeURIComponent(query)}`}>
                      Create "{query}" page
                    </Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="users">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {filtered.users.length > 0 ? (
                <div className="space-y-2">
                  {filtered.users.map(user => (
                    <div key={user.id} className="flex items-center">
                      <PillLink href={`/u/${user.id}`}>
                        {user.username}
                      </PillLink>
                      <span className="text-xs text-muted-foreground ml-2">
                        User
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No users found for "{query}"</p>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
