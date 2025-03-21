"use client";
import React, { useContext, useEffect } from "react";
import { DataContext } from "../providers/DataProvider";
import { AuthContext } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";
import { PillLink, PillLinkSkeleton } from "./PillLink";
import Link from "next/link";
import { Button } from "./ui/button";
import { Loader, Plus } from "lucide-react";

const PageSkeletons = ({ count = 8 }) => {
  return (
    <div className="relative">
      <ul className="flex flex-wrap gap-1">
        {Array(count).fill(0).map((_, index) => (
          <li key={`skeleton-${index}`}>
            <PillLinkSkeleton />
          </li>
        ))}
      </ul>
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </div>
  );
};

const AllPages = () => {
  const { pages, loading, loadMorePages, isMoreLoading, hasMorePages } = useContext(DataContext);  
  const { user } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <PageSkeletons />;
  }

  if (!user) {
    return null;
  }

  if (!pages || pages.length === 0) {
    return (
      <div className="flex justify-center">
        <div className="relative bg-background border-2 border-dashed border-border/40 rounded-[24px] p-8 max-w-md w-full text-center">
          <div className="text-foreground text-xl mb-4">
            You don't have any pages yet!
          </div>
          <div className="text-muted-foreground mb-6">
            Create your first page to start writing
          </div>
          <Button variant="outline" asChild>
            <Link href="/new" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create a page
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const displayPages = pages ? pages.slice(0, 20) : [];

  return (
    <>
    <div className="relative">
      <div className="flex flex-wrap gap-2 justify-start items-start content-start">
        {displayPages.map((page) => (
          <div key={page.id} className="flex-none">
            <PillLink
              groupId={page.groupId}
              href={`/pages/${page.id}`}
              isPublic={page.isPublic}
              byline={page.authorName}
            >
              {page.title}
            </PillLink>
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </div>
    <div className="flex justify-center mt-2">
        {pages.length > 0 && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/user/${user.uid}`}>View all</Link>
          </Button>
        )}
    </div>
    </>
  );
};

export default AllPages;
