"use client";
import React, { useContext } from "react";
import { DataContext } from "../providers/DataProvider";
import { AuthContext } from "../providers/AuthProvider";
import { PillLink } from "./PillLink";
import { Icon } from "@iconify/react/dist/iconify.js";

const AllPages = () => {
  const { pages, loading, loadMorePages, isMoreLoading, hasMorePages } = useContext(DataContext);  const { user } = useContext(AuthContext);

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
    <div>
      <ul className="space-x-1 flex flex-wrap">
        {pages.map((page, index) => {
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
    </div>
    <div className="flex justify-center mt-4">
        {
          hasMorePages && (
            <button
              className="bg-primary text-white px-4 py-2 rounded-full"
              onClick={loadMorePages}
              disabled={isMoreLoading}
            >
              {isMoreLoading ? "Loading..." : "Load more"}
            </button>
          )
        }
      </div>
    </>
  );
};

export default AllPages;
