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

const dateColumnSort = (rowA, rowB, columnId) => {
  return new Date(rowA.createdAt) - new Date(rowB.createdAt);
}

const Page = () => {
  const { pages } = useContext(DataContext);
  const [viewType, setViewType] = useState("list");

  return (
    <DashboardLayout>
      <div className="p-4">

        <TopUsers />
        <h1 className="text-2xl font-semibold">Your Pages</h1>
        <div className="flex items-center pb-4 mb-4 align-middle justify-between">
          <div className="w-1/2"><Search /></div>
          {/* <Link href="/new">
            <button className="bg-white border border-gray-500 hover:bg-gray-200 text-black rounded-lg px-4 py-2 mt-4">
              Add Page
            </button>
          </Link> */}
          <div className="flex justify-end gap-4 mt-4">
            <button
              className={`${
                viewType !== "list" ? "bg-white" : "border border-gray-500"
              } text-black px-4 py-2 rounded`}
              onClick={() => setViewType("list")}
            >
              List
            </button>
            <button
              className={`${
                viewType !== "table" ? "bg-white" : "border border-gray-500"
              } text-black px-4 py-2 rounded`}
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
        {viewType === "table" && (
          <Table pages={pages} />
        )}
      </div>
    </DashboardLayout>
  );
};

const Table = ({ pages }) => {
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
        <Link className="text-blue-500 underline" href={`/pages/${row.id}`}>
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
      sortFunction: dateColumnSort
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
            <button className="bg-white text-black border border-gray-500 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
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
    />
  );
}


export default Page;
