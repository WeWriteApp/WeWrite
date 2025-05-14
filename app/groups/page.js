"use client";

import React, { useState, useEffect } from "react";
import EnhancedMyGroups from "../components/EnhancedMyGroups";
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
        <Link href="/group/new">
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Group
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <GroupsLoadingSkeleton />
      ) : (
        <EnhancedMyGroups />
      )}


    </div>
  );
}

// Loading skeleton for groups
function GroupsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Desktop view skeleton (md and up) */}
      <div className="hidden md:block border border-theme-medium rounded-lg overflow-hidden shadow-md dark:bg-card/90 w-full">
        <div className="p-4">
          <div className="flex justify-between border-b border-border pb-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
          </div>

          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="py-4 border-b border-border/50">
              <div className="flex justify-between items-center">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-12 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile view skeleton (below md) */}
      <div className="md:hidden grid grid-cols-1 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <Skeleton className="h-6 w-1/3" />
              <div className="flex items-center mt-1">
                <Skeleton className="h-4 w-1/2 mr-2" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <div className="flex space-x-3">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
                <Skeleton className="h-14 w-28 rounded-md" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
