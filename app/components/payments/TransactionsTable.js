"use client";
import React, { useEffect, useState, useContext } from "react";
import { PortfolioContext } from "../providers/PortfolioProvider";
import DataTable from "react-data-table-component";

const TransactionsTable = ({
  id
}) => {
  const { transactions } = useContext(PortfolioContext);
  const filteredTransactions = transactions.filter(
    (transaction) => transaction.paidFor === id
  );


  const columns = [
    {
      name: "ID",
      selector: (row) => row.id,
      sortable: true,
    },
    {
      name: "Paid to",
      selector: (row) => row.paidTo,
      sortable: true,
    },
    {
      name: "Paid for",
      selector: (row) => row.paidFor,
      sortable: true,
    },
    {
      name: "Paid by",
      selector: (row) => row.paidBy,
      sortable: true,
    },
    {
      name: "Amount",
      selector: (row) => row.amount,
      sortable: true,
    },
    {
      name: "Date",
      selector: (row) => row.date,
      cell: (row) => <div>{new Date(row.date).toLocaleDateString()}</div>,
      sortable: true,
    },
    {
      name: "Status",
      selector: (row) => row.status,
      cell: (row) => (
        <div>
          {row.status === "completed" ? (
            <span className="badge rounded-full py-1 px-2 text-sm bg-gray-200">
              Complete
            </span>
          ) : (
            <span className="badge badge-danger">Pending</span>
          )}
        </div>
      ),
      sortable: true,
    },
  ];

  if (!transactions) {
    return <div>Loading...</div>;
  }
  return (
    <div className="pt-10 mb-0">
      <DataTable columns={columns} data={filteredTransactions} />
    </div>
  );
};

export default TransactionsTable;
