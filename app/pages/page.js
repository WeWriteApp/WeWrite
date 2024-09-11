"use client";
import React, { useEffect, useState, useContext } from "react";
import DashboardLayout from "../DashboardLayout";
import Link from "next/link";
import { DataContext } from "../providers/DataProvider";
import AllPages from "../components/AllPages";
import Search from "../components/Search";
import TopUsers from "../components/TopUsers";
import { AuthContext } from "../providers/AuthProvider";
import YourGroups from "../components/YourGroups";

const Page = () => {
  const { pages } = useContext(DataContext);
  const { user } = useContext(AuthContext);

  return (
    <DashboardLayout>
      <div>
        <TopUsers />

        {user && (
          <>
            <div className="flex items-start pb-4 mb-- md:mb-0 md:align-middle md:justify-between md:flex-row justify-between">
              <h1 className="text-2xl font-semibold text-text">Your Groups</h1>
              <Link
                className="bg-background text-button-text border border-gray-500 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                href="/groups/new"
              >
                Create Group
              </Link>
            </div>
            <YourGroups />

            <h1 className="text-2xl font-semibold text-text">Your Pages</h1>
            <div className="flex items-center pb-2 md:align-middle md:justify-between md:flex-row flex-col">
              <div className="md:w-1/2 w-full">
                <Search />
              </div>
            </div>

            <AllPages pages={pages} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Page;
