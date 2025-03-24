"use client";
import React, { useContext, useEffect } from "react";
import { DataContext } from "../providers/DataProvider";
import { AuthContext } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "./ui/button";
import { Plus } from "lucide-react";
import PageList from "./PageList";

const AllPages = () => {
  const { pages, loading, loadMorePages, isMoreLoading, hasMorePages } = useContext(DataContext);  
  const { user } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <PageList loading={true} pages={[]} />;
  }

  // Transform pages into the format expected by PageList
  const formattedPages = pages ? pages.map(page => ({
    id: page.id,
    title: page.title,
    isPublic: page.isPublic,
    userId: page.userId,
    authorName: page.authorName,
    lastModified: page.lastModified,
    createdAt: page.createdAt,
    groupId: page.groupId
  })) : [];

  return (
    <PageList
      pages={formattedPages}
      mode="wrapped"
      showCreateButton={false}
      createButtonHref="/new"
      createButtonText="Create a page"
      showViewAll={true}
      viewAllHref={`/user/${user.uid}`}
      viewAllText="View all"
      emptyState={
        <div className="flex justify-center">
          <div className="relative bg-background border-2 border-dashed border-border/40 rounded-[24px] p-8 max-w-md w-full text-center">
            <div className="text-foreground text-xl mb-4">
              You don't have any pages yet!
            </div>
            <div className="text-muted-foreground mb-6">
              Create your first page to start writing
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/new" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create a page
              </Link>
            </Button>
          </div>
        </div>
      }
    />
  );
};

export default AllPages;
