"use client";
import React, { useEffect, useState, useContext } from "react";
import DashboardLayout from "../DashboardLayout";
import DataTable from "react-data-table-component";
import Link from "next/link";
import { DataContext } from "../providers/DataProvider";

const Page = () => {
  const { pages, loading } = useContext(DataContext);
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
      cell: (row) => <Link 
        className="text-blue-500 underline"
      href={`/pages/${row.id}`}>{row.title}</Link>,
      sortable: true,
    },
  ]);

  if (loading) return <DashboardLayout>Loading...</DashboardLayout>;
  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-semibold">All Pages</h1>
        <DataTable columns={columns} data={pages} pagination highlightOnHover />
      </div>
    </DashboardLayout>
  );
};

export default Page;
