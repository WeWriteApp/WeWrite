"use client";
import React, { useEffect, useState, useContext } from "react";
import DashboardLayout from "../DashboardLayout";
import DataTable from "react-data-table-component";
import Link from "next/link";
import { DataContext } from "../providers/DataProvider";
import { removeDoc } from "../firebase/database";
import { PillLink } from "../components/PillLink";

// Custom sort function for date columns
const dateColumnSort = (rowA, rowB, columnId) => {
  return new Date(rowA.createdAt) - new Date(rowB.createdAt);
}

const Page = () => {
  const { pages, loading, deletePageState, fetchPages } =
    useContext(DataContext);
  const [viewType, setViewType] = useState("list");
  const deletePage = async (id) => {
    const res = await removeDoc("pages", id);
    if (res) {
      deletePageState(id);
    } else {
      console.log("Error deleting page");
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

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
      name: "Actions",
      cell: (row) => (
        <div className="flex space-x-2">
          <Link href={`/pages/${row.id}/edit`}>
            <button className="bg-blue-500 text-white px-2 py-1 rounded">
              Edit
            </button>
          </Link>
          <button
            className="bg-red-500 text-white px-2 py-1 rounded"
            onClick={() => deletePage(row.id)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ]);

  // if (loading) return <DashboardLayout>Loading...</DashboardLayout>;
  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-semibold">All Pages</h1>
        {/* Add page button (navigate to /new) */}
        <Link href="/new">
          <button className="bg-blue-500 text-white px-4 py-2 rounded mt-4">
            Add Page
          </button>
        </Link>
        <div className="flex justify-end gap-4 mt-4">
          <button
            className={`${
              viewType === "list" ? "bg-blue-500" : "bg-gray-500"
            } text-white px-4 py-2 rounded`}
            onClick={() => setViewType("list")}
          >
            List
          </button>
          <button
            className={`${
              viewType === "table" ? "bg-blue-500" : "bg-gray-500"
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
                <PillLink key={page.id} href={`/pages/${page.id}`}>
                  {page.title}
                </PillLink>
              ))}
          </>
        )}
        {
          viewType === "table" && (
            <DataTable
              columns={columns}
              data={pages}
              pagination
              highlightOnHover
            />
          )
        }
      </div>
    </DashboardLayout>
  );
};

export default Page;
