"use client";
import React, { useEffect, useState, useContext } from "react";
import { PortfolioContext } from "../../providers/PortfolioProvider";
import DataTable from "react-data-table-component";

import { useAuth } from "../../providers/AuthProvider";
const PayoutsTable = () => {
  const { user } = useAuth();
  // Payments feature is now always enabled - no conditional rendering needed
  const {
    payouts} = useContext(PortfolioContext);
  const columns = [
    {
      name: "ID",
      selector: (row) => row.id,
      sortable: true},
    {
      name: "Status",
      selector: (row) => row.status,
      cell: (row) => (
        <div>
          {row.status === "paid" ? (
            <span className="badge rounded-full py-1 px-2 text-sm bg-gray-200">
              Paid
            </span>
          ) : (
            <span className="badge badge-danger">Unpaid</span>
          )}
        </div>
      ),
      sortable: true},
  ];

  if (!payouts) {
    return <div>Loading...</div>;
  }
  return (
    <div className="pt-10 mb-0">
      <DataTable
        title="Payouts"
        columns={columns}
        data={payouts}
      />
    </div>
  );
};

export default PayoutsTable;