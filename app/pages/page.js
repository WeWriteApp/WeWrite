"use client";
import React, { useEffect, useState, useContext } from "react";
import DashboardLayout from "../DashboardLayout";
import DataTable from "react-data-table-component";
import Link from "next/link";
import { DataContext } from "../providers/DataProvider";
import { PillLink } from "../components/PillLink";
import { Icon } from "@iconify/react/dist/iconify.js";

const dateColumnSort = (rowA, rowB, columnId) => {
  return new Date(rowA.createdAt) - new Date(rowB.createdAt);
}

const Page = () => {
  const { pages, loading, deletePageState, fetchPages } =
    useContext(DataContext);
  const [viewType, setViewType] = useState("list");

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
      name: "Is Private",
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
            <button className="bg-black text-white px-2 py-1 rounded">
              Edit
            </button>
          </Link>
          {/* <button
            className="bg-red-500 text-white px-2 py-1 rounded"
            onClick={() => deletePage(row.id)}
          >
            Delete
          </button> */}
        </div>
      ),
    },
  ]);

  return (
    <DashboardLayout>
      <div className="p-4">
        <h1 className="text-2xl font-semibold">All Pages</h1>
        <Link href="/new">
          <button className="bg-black text-white px-4 py-2 mt-4">
            Add Page
          </button>
        </Link>
        <div className="flex justify-end gap-4 mt-4">
          <button
            className={`${
              viewType === "list" ? "bg-black" : "bg-gray-500"
            } text-white px-4 py-2 rounded`}
            onClick={() => setViewType("list")}
          >
            List
          </button>
          <button
            className={`${
              viewType === "table" ? "bg-black" : "bg-gray-500"
            } text-white px-4 py-2 rounded`}
            onClick={() => setViewType("table")}
          >
            Table
          </button>
        </div>

        {viewType === "list" && (
          <>
            {pages &&
              pages.map((page) => (
                <PillLink key={page.id} href={`/pages/${page.id}`} isPublic={page.isPublic}>
                  {page.title}
                </PillLink>
              ))}
          </>
        )}
        {viewType === "table" && (
          <DataTable
            columns={columns}
            data={pages}
            pagination
            highlightOnHover
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Page;
