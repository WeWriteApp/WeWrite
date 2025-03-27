"use client";

import React, { useState, useEffect } from "react";
import MyGroups from "../components/MyGroups";
import { Button } from "../components/ui/button";
import { Plus, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "../components/ui/skeleton";
import { Card, CardContent, CardHeader } from "../components/ui/card";

export default function GroupsPage() {
  const [isLoading, setIsLoading] = useState(true);

  // Simulate loading state for demonstration
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Back to home</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Groups</h1>
            <p className="text-muted-foreground mt-1">
              Collaborate with others in shared writing spaces
            </p>
          </div>
        </div>
        <Link href="/groups/new">
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Group
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <GroupsLoadingSkeleton />
      ) : (
        <div className="grid-container">
          <MyGroups />
        </div>
      )}

      <style jsx>{`
        .grid-container :global(.space-y-4) {
          margin-top: 0;
        }
        
        .grid-container :global(.space-y-4 > div:first-child) {
          margin-bottom: 1rem;
        }
        
        .grid-container :global(.space-y-4 > div:not(:first-child)) {
          display: grid;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 1rem;
        }
        
        @media (min-width: 640px) {
          .grid-container :global(.space-y-4 > div:not(:first-child)) {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        
        @media (min-width: 1024px) {
          .grid-container :global(.space-y-4 > div:not(:first-child)) {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}

// Loading skeleton for groups
function GroupsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardContent className="pb-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
