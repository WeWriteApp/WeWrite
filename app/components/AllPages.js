"use client";
import React, { useContext } from "react";
import { DataContext } from "../providers/DataProvider";
import { AuthContext } from "../providers/AuthProvider";
import { PillLink } from "./PillLink";
import { Icon } from "@iconify/react/dist/iconify.js";
import Link from "next/link";

const AllPages = () => {
  const { pages, loading, loadMorePages, isMoreLoading, hasMorePages } = useContext(DataContext);  
  const { user } = useContext(AuthContext);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center">
        <Icon
          icon="eos-icons:three-dots-loading"
          className="text-gray-500 text-7xl"
        />
      </div>
    );
  }
  if (!pages) {
    return <div>No pages found</div>;
  }
  return (
    <>
    <div className="relative">
      <ul className="space-x-1 flex flex-wrap max-h-[120px] overflow-hidden">
        {pages.map((page, index) => {
          if (index >= 6) return null;
          return (
            <li key={page.id}>
              <PillLink
                groupId={page.groupId}
                href={`/pages/${page.id}`}
                isPublic={page.isPublic}
              >
                {page.title}
              </PillLink>
            </li>
          );
        })}
      </ul>
      {pages.length > 6 && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      )}
    </div>
    <div className="flex justify-center mt-4">
        {
          pages.length > 6 && (
            <Link href={`/user/${user.uid}`} className="bg-primary text-white px-4 py-2 rounded-full">
              View all
            </Link>
          )
        }
      </div>
    </>
  );
};

export default AllPages;
