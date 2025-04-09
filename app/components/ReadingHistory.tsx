"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock, Trash2, X } from "lucide-react";
import { Button } from "./ui/button";
import { db } from "../firebase/config";
import { collection, query, where, orderBy, limit, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../providers/AuthProvider";
import Link from "next/link";
import { toast } from "sonner";
import FollowButton from "./FollowButton";
import { cn } from "../lib/utils";

interface HistoryItem {
  id: string;
  pageId: string;
  pageTitle: string;
  pageOwnerId: string;
  pageOwnerName: string;
  timestamp: string;
}

export default function ReadingHistory() {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

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

        // Query the reading history collection
        const historyRef = collection(db, "readingHistory");
        const historyQuery = query(
          historyRef,
          where("userId", "==", user.uid),
          orderBy("timestamp", "desc"),
          limit(50)
        );

        const snapshot = await getDocs(historyQuery);
        
        if (snapshot.empty) {
          setHistoryItems([]);
          setIsLoading(false);
          return;
        }

        // Convert the snapshot to history items
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          pageId: doc.data().pageId,
          pageTitle: doc.data().pageTitle || "Untitled",
          pageOwnerId: doc.data().pageOwnerId || "",
          pageOwnerName: doc.data().pageOwnerName || "Anonymous",
          timestamp: doc.data().timestamp?.toDate?.() || new Date()
        }));

        setHistoryItems(items);
      } catch (err) {
        console.error("Error fetching reading history:", err);
        setError("Failed to load reading history");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  // Remove an item from history
  const removeFromHistory = async (itemId: string) => {
    if (!user) return;

    try {
      // Delete the history item from Firestore
      const historyItemRef = doc(db, "readingHistory", itemId);
      await deleteDoc(historyItemRef);

      // Update the local state
      setHistoryItems(prev => prev.filter(item => item.id !== itemId));
      
      toast.success("Removed from history");
    } catch (err) {
      console.error("Error removing history item:", err);
      toast.error("Failed to remove from history");
    }
  };

  // Clear all history
  const clearAllHistory = async () => {
    if (!user || historyItems.length === 0) return;

    try {
      // Delete all history items for this user
      // Note: In a production app, you might want to use a batch or transaction
      // for better performance and atomicity
      const deletePromises = historyItems.map(item => 
        deleteDoc(doc(db, "readingHistory", item.id))
      );
      
      await Promise.all(deletePromises);
      
      // Update the local state
      setHistoryItems([]);
      
      toast.success("History cleared");
    } catch (err) {
      console.error("Error clearing history:", err);
      toast.error("Failed to clear history");
    }
  };

  // Format the timestamp
  const formatTimestamp = (timestamp: string | Date) => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    
    // If it's today, show the time
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // If it's yesterday, show "Yesterday"
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Otherwise, show the date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Reading History</h3>
        </div>
        <div className="space-y-2 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Reading History</h3>
        </div>
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
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Reading History</h3>
        {historyItems.length > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={clearAllHistory}
            className="text-xs"
          >
            Clear All
          </Button>
        )}
      </div>

      {historyItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <Clock className="h-12 w-12 mb-2 opacity-20" />
          <h4 className="text-sm font-medium mb-1">No reading history</h4>
          <p className="text-xs max-w-[200px]">
            Pages you visit will appear here for easy access
          </p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto">
          {historyItems.map(item => (
            <div 
              key={item.id} 
              className="p-3 border rounded-lg hover:bg-accent/10 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <Link 
                  href={`/${item.pageId}`}
                  className="font-medium hover:underline truncate max-w-[180px]"
                >
                  {item.pageTitle}
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeFromHistory(item.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {formatTimestamp(item.timestamp)}
                </div>
                <FollowButton 
                  pageId={item.pageId} 
                  pageTitle={item.pageTitle}
                  pageOwnerId={item.pageOwnerId}
                  className="h-7"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
