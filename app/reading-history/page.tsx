"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock, Trash2, X, ChevronLeft, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { db } from "../firebase/config";
import { collection, query, where, orderBy, limit, getDocs, doc, deleteDoc } from "firebase/firestore";
import { useAuth } from "../providers/AuthProvider";
import Link from "next/link";
import { toast } from "sonner";
import FollowButton from "../components/FollowButton";
import { cn } from "../lib/utils";
import { PageLoader } from "../components/ui/page-loader";
import { getReadingHistory, clearReadingHistory, removeFromHistory } from "../firebase/readingHistory";
import { useWeWriteAnalytics } from "../hooks/useWeWriteAnalytics";

interface HistoryItem {
  id: string;
  pageId: string;
  pageTitle: string;
  pageOwnerId: string;
  pageOwnerName: string;
  timestamp: Date | string;
  isError?: boolean;
  errorType?: string;
}

export default function ReadingHistoryPage() {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const { trackFeatureEvent } = useWeWriteAnalytics();

  // Fetch reading history
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) {
        setHistoryItems([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Get reading history using the function from readingHistory.js
        const items = await getReadingHistory(user.uid, 100);
        
        // Check if there's an error item
        const errorItem = items.find(item => item.isError);
        if (errorItem) {
          if (errorItem.errorType === 'index') {
            setError("Reading history is being set up. Please try again in a few minutes.");
          } else {
            setError("Failed to load reading history");
          }
          setHistoryItems([]);
        } else {
          setHistoryItems(items);
          setFilteredItems(items);
        }
      } catch (err) {
        console.error("Error fetching reading history:", err);
        setError("Failed to load reading history");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  // Filter history items when search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredItems(historyItems);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = historyItems.filter(item => 
      item.pageTitle.toLowerCase().includes(query) || 
      item.pageOwnerName.toLowerCase().includes(query)
    );
    
    setFilteredItems(filtered);
  }, [searchQuery, historyItems]);

  // Remove an item from history
  const handleRemoveFromHistory = async (itemId: string) => {
    if (!user) return;

    try {
      // Delete the history item using the function from readingHistory.js
      const success = await removeFromHistory(itemId);
      
      if (success) {
        // Update the local state
        setHistoryItems(prev => prev.filter(item => item.id !== itemId));
        toast.success("Removed from history");
        
        // Track the event
        trackFeatureEvent("reading_history_item_removed");
      } else {
        toast.error("Failed to remove from history");
      }
    } catch (err) {
      console.error("Error removing history item:", err);
      toast.error("Failed to remove from history");
    }
  };

  // Clear all history
  const handleClearHistory = async () => {
    if (!user || isClearing) return;

    try {
      setIsClearing(true);
      
      // Clear all reading history using the function from readingHistory.js
      const success = await clearReadingHistory(user.uid);
      
      if (success) {
        setHistoryItems([]);
        setFilteredItems([]);
        toast.success("Reading history cleared");
        
        // Track the event
        trackFeatureEvent("reading_history_cleared");
      } else {
        toast.error("Failed to clear history");
      }
    } catch (err) {
      console.error("Error clearing history:", err);
      toast.error("Failed to clear history");
    } finally {
      setIsClearing(false);
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: Date | string) => {
    if (!timestamp) return "Unknown date";
    
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) return "Invalid date";
    
    // Format the date
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 30) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return <PageLoader message="Loading reading history..." />;
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.back()}
          className="mr-4"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Reading History</h1>
      </div>

      {error ? (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
          <p>{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Search history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Button
              variant="destructive"
              onClick={handleClearHistory}
              disabled={historyItems.length === 0 || isClearing}
              className="whitespace-nowrap"
            >
              {isClearing ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear History
                </>
              )}
            </Button>
          </div>

          {historyItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg">
              <Clock className="h-16 w-16 mb-4 text-muted-foreground/30" />
              <h2 className="text-xl font-medium mb-2">No reading history</h2>
              <p className="text-muted-foreground max-w-md">
                Pages you visit will appear here for easy access. Start browsing to build your reading history.
              </p>
              <Button 
                variant="default" 
                className="mt-6"
                onClick={() => router.push('/')}
              >
                Browse Pages
              </Button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center p-8 border rounded-lg">
              <p className="text-muted-foreground">No results found for "{searchQuery}"</p>
              <Button 
                variant="link" 
                onClick={() => setSearchQuery('')}
                className="mt-2"
              >
                Clear search
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map(item => (
                <div 
                  key={item.id} 
                  className="p-4 border rounded-lg hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Link 
                      href={`/${item.pageId}`}
                      className="font-medium hover:underline text-lg truncate max-w-[80%]"
                    >
                      {item.pageTitle}
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRemoveFromHistory(item.id)}
                      aria-label="Remove from history"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground mb-3">
                    <span>by {item.pageOwnerName || "Anonymous"}</span>
                    <span className="mx-2">•</span>
                    <span>{formatTimestamp(item.timestamp)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <Link 
                      href={`/${item.pageId}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Read page
                    </Link>
                    <FollowButton 
                      pageId={item.pageId} 
                      pageTitle={item.pageTitle}
                      pageOwnerId={item.pageOwnerId}
                      className="h-8"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
