"use client";
import React, { useEffect, useState, useContext } from "react";
import { PortfolioContext } from "../providers/PortfolioProvider";
import DataTable from "react-data-table-component";
import { Tooltip } from "react-tooltip";
import { Icon } from "@iconify/react/dist/iconify.js";
import Link from "next/link";

const SubscriptionsTable = () => {
  const {
    subscriptions,
    removeSubscription,
    activateSubscription,
    totalSubscriptionsCost,
  } = useContext(PortfolioContext);
  const columns = [
    {
      name: "ID",
      selector: (row) => row.id,
      sortable: true,
      cell: (row) => (
        <Link href={`/pages/${row.id}`}>
          <p className="text-blue-500 underline">{row.id}</p>
        </Link>
      ),
    },
    {
      name: "Amount",
      selector: (row) => row.amount,
      sortable: true,
    },
    {
      name: "Date",
      selector: (row) => row.date,
      sortable: true,
      cell: (row) => new Date(row.date).toLocaleDateString(),
    },
    {
      name: "Status",
      selector: (row) => row.status,
      cell: (row) => (
        <div>
          {row.status === "active" ? (
            <span className="badge rounded-full py-1 px-2 text-sm bg-gray-200">
              Active
            </span>
          ) : (
            <span className="badge badge-danger">Inactive</span>
          )}
        </div>
      ),
      sortable: true,
    },
    {
      name: "Actions",
      cell: (row) => (
        <div>
          {row.status === "active" ? (
            <button
              className="text-gray-500 hover:text-gray-700 p-2"
              onClick={() => removeSubscription(row.id)}
              data-tooltip-id="remove"
              data-tooltip-place="top"
              data-tooltip-content={"Deactivate"}
            >
              <Icon icon="akar-icons:trash" />
              <Tooltip id="remove" place="top" />
            </button>
          ) : (
            <button
              data-tooltip-id="activate"
              data-tooltip-place="top"
              data-tooltip-content={"Activate"}
              className="text-gray-500 hover:text-gray-700 p-2"
              onClick={() => activateSubscription(row.id)}
            >
              <Icon icon="akar-icons:play" />
              <Tooltip id="activate" place="top" />
            </button>
          )}
        </div>
      ),
    },
  ];

  if (!subscriptions) {
    return <div>Loading...</div>;
  }
  return (
    <div className="pt-10 mb-0">
      <DataTable
        // sort by status with active at top
        sortFunction={{
          status: (a, b) => {
            if (a === "active") return -1;
            if (b === "active") return 1;
            return 0;
          },
        }}
        columns={columns}
        data={subscriptions}
      />
    </div>
  );
};

export default SubscriptionsTable;
