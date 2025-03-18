"use client";
import React, { useContext } from "react";
import { DataContext } from "../providers/DataProvider";
import { AuthContext } from "../providers/AuthProvider";
import { PillLink, PillLinkSkeleton } from "./PillLink";
import Link from "next/link";
import Button from "./Button";
import { Loader } from "lucide-react";

const PageSkeletons = ({ count = 8 }) => {
  return (
    <div className="relative">
      <ul className="space-x-1 space-y-1 flex flex-wrap grid-rows-4 max-h-[calc(4*2.5rem)] overflow-hidden">
        {Array(count).fill(0).map((_, index) => (
          <li key={`skeleton-${index}`} className="my-1">
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

  if (loading || !user) {
    return <PageSkeletons />;
  }

  if (!pages) {
    return <div>No pages found</div>;
  }

  return (
    <>
    <div className="relative">
      <ul className="space-x-1 space-y-1 flex flex-wrap grid-rows-4 max-h-[calc(4*2.5rem)] overflow-hidden">
        {pages.map((page) => (
          <li key={page.id}>
            <PillLink
              groupId={page.groupId}
              href={`/pages/${page.id}`}
              isPublic={page.isPublic}
              byline={page.authorName}
            >
              {page.title}
            </PillLink>
          </li>
        ))}
      </ul>
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </div>
    <div className="flex justify-center mt-4">
        {pages.length > 0 && (
          <Link href={`/user/${user.uid}`}>
            <Button type="primary" variant="default">View all</Button>
          </Link>
        )}
    </div>
    </>
  );
};

export default AllPages;
