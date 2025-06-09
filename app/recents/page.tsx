"use client";

import React, { useState, useEffect, useContext } from 'react';
import { Clock, FileText, User, Calendar, Search, Filter } from 'lucide-react';
import { AuthContext } from '../providers/AuthProvider';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { PillLink } from '../components/utils/PillLink';
import { Skeleton } from '../components/ui/skeleton';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../components/layout/Header';
import { RecentPagesContext } from '../contexts/RecentPagesContext';

/**
 * Recents Page Component
 * 
 * Displays a comprehensive list of recently visited pages for authenticated users.
 * Features search, filtering, and detailed page information.
 */
export default function RecentsPage() {
  const { user } = useContext(AuthContext);
  const { recentPages, loading } = useContext(RecentPagesContext);
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPages, setFilteredPages] = useState([]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
  }, [user, router]);

  // Filter pages based on search term
  useEffect(() => {
    if (!recentPages) {
      setFilteredPages([]);
      return;
    }

    if (!searchTerm.trim()) {
      setFilteredPages(recentPages);
      return;
    }

    const filtered = recentPages.filter(page =>
      page.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      page.username?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredPages(filtered);
  }, [recentPages, searchTerm]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInHours < 168) { // 7 days
      const days = Math.floor(diffInHours / 24);
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <>
      <Header />
      <main className="p-6 bg-background min-h-screen">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">Recent Pages</h1>
                <p className="text-muted-foreground">
                  Pages you've visited recently
                </p>
              </div>
            </div>
            
            <Link href="/">
              <Button variant="outline" size="sm">
                Back to Home
              </Button>
            </Link>
          </div>

          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search recent pages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Content */}
          {loading ? (
            // Loading state
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border border-border rounded-lg">
                  <Skeleton className="h-5 w-5" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : filteredPages.length === 0 ? (
            // Empty state
            <div className="text-center py-12">
              <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {searchTerm ? 'No matching pages found' : 'No recent pages yet'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm 
                  ? 'Try adjusting your search terms'
                  : 'Start exploring pages to see them appear here'
                }
              </p>
              {!searchTerm && (
                <Link href="/">
                  <Button>
                    Explore Pages
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            // Recent pages list
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {filteredPages.length} page{filteredPages.length !== 1 ? 's' : ''} found
                </p>
              </div>
              
              {filteredPages.map((page) => (
                <div
                  key={page.id}
                  className="group flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <PillLink
                      href={`/${page.id}`}
                      className="block hover:no-underline"
                    >
                      <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {page.title || 'Untitled'}
                      </h3>
                    </PillLink>
                    
                    {page.username && (
                      <div className="flex items-center gap-1 mt-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          by {page.username}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                    <Calendar className="h-3 w-3" />
                    <span>{formatTimestamp(page.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
