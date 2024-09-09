"use client";
import React, { useEffect, useState, useContext } from "react";
import DashboardLayout from "../DashboardLayout";
import DataTable from "react-data-table-component";
import Link from "next/link";
import { DataContext } from "../providers/DataProvider";
import { Icon } from "@iconify/react/dist/iconify.js";
import AllPages from "../components/AllPages";
import Search from "../components/Search";
import TopUsers from "../components/TopUsers";
import { AuthContext } from "../providers/AuthProvider";
import YourGroups from "../components/YourGroups";
import { useTheme } from "../providers/ThemeProvider";

const dateColumnSort = (rowA, rowB, columnId) => {
  return new Date(rowA.createdAt) - new Date(rowB.createdAt);
};

const Page = () => {
  const { pages } = useContext(DataContext);
  const { user } = useContext(AuthContext);
  const [viewType, setViewType] = useState("list");

  return (
    <DashboardLayout>
      <div>
        <TopUsers />

        {user && (
          <>
          <div className="flex items-center pb-4 mb-4 md:mb-0 md:align-middle md:justify-between md:flex-row flex-col">
            <h1 className="text-2xl font-semibold text-text">Your Groups</h1>
            <Link className="bg-background text-button-text border border-gray-500 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors" href="/groups/new">
              Create Group
            </Link>
          </div>
            <YourGroups />
            
            <h1 className="text-2xl font-semibold text-text">Your Pages</h1>
            <div className="flex items-center pb-4 mb-4 md:align-middle md:justify-between md:flex-row flex-col">
              <div className="md:w-1/2 w-full">
                <Search />
              </div>
              <div className="flex md:justify-end gap-4 md:mt-0 w-full md:w-1/2">
                <button
                  className={`${
                    viewType !== "list" ? "bg-background" : "border border-gray-500"
                  } text-button-text px-4 py-2 rounded`}
                  onClick={() => setViewType("list")}
                >
                  List
                </button>
                <button
                  className={`${
                    viewType !== "table" ? "bg-background" : "border border-gray-500"
                  } text-button-text px-4 py-2 rounded`}
                  onClick={() => setViewType("table")}
                >
                  Table
                </button>
              </div>
            </div>

            {viewType === "list" && (
              <>
                <AllPages />
              </>
            )}
            {viewType === "table" && <Table pages={pages} />}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

const Table = ({ pages }) => {
  const { theme } = useTheme();
  const [columns, setColumns] = useState([
    {
      name: "User",
      selector: (row) => row.userId,
      maxWidth: "140px",
      sortable: true,
    },
    {
      name: "Title",
      selector: (row) => row.title,
      maxWidth: "240px",
      cell: (row) => (
        <Link className="text-primary underline" href={`/pages/${row.id}`}>
          {row.title}
        </Link>
      ),
      sortable: true,
    },
    {
      name: "Created At",
      cell: (row) => new Date(row.createdAt).toLocaleDateString(),
      maxWidth: "140px",
      sortable: true,
      sortFunction: dateColumnSort,
    },
    {
      name: "Is Public",
      cell: (row) => (
        <Icon
          icon={row.isPublic ? "akar-icons:check" : "akar-icons:lock-on"}
          className={row.isPublic ? "text-green-500" : "text-red-500"}
        />
      ),
      sortable: true,
    },
    {
      name: "Actions",
      cell: (row) => (
        <div className="flex space-x-2">
          <Link href={`/pages/${row.id}/edit`}>
            <button className="bg-background text-button-text border border-gray-500 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
              Edit
            </button>
          </Link>
        </div>
      ),
    },
  ]);
  return (
    <DataTable
      columns={columns}
      data={pages}
      pagination
      highlightOnHover
      striped
      theme={theme}
    />
  );
};

export default Page;
