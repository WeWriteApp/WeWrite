"use client";
import React, { useContext } from "react";
import { DataContext } from "../providers/DataProvider";
import { PillLink } from "./PillLink";
import { Icon } from "@iconify/react/dist/iconify.js";

const AllPages = () => {
  const { pages, loading } = useContext(DataContext);

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <Icon
          icon="eos-icons:three-dots-loading"
          className="text-gray-500 text-7xl"
        />
      </div>
    );
  }
  return (
    <div>
      <ul className="space-x-1 flex flex-wrap">
        {pages.map((page, index) => {
          // TODO: only query user pages 
          if (page.groupId) {
            return null; // Skip pages with groupId
          }
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
  );
};

export default AllPages;
