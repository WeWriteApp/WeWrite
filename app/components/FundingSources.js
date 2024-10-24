"use client";
import React, { useEffect, useState, useContext } from "react";
import { PortfolioContext } from "../providers/PortfolioProvider";
import DataTable from "react-data-table-component";
import { Icon } from "@iconify/react/dist/iconify.js";
import PaymentCard from "./card/PaymentCard";

const FundingSources = () => {
  const { fundingSources } = useContext(PortfolioContext);
  const [showAddFundingSource, setShowAddFundingSource] = useState(false);
  const columns = [
    {
      name: "Type",
      selector: (row) => row.type,
      sortable: true,
    },
    {
      name: "Last 4",
      selector: (row) => row.last4,
      sortable: true,
    },
    {
      name: "Default",
      selector: (row) => row.default,
      cell: (row) => (
        <div>
          {row.default ? (
            <Icon icon="akar-icons:check" className="text-green-500" />
          ) : (
            <Icon icon="akar-icons:close" className="text-red-500" />
          )}
        </div>
      ),
      sortable: true,
    },
  ];

  if (!fundingSources) {
    return <div>Loading...</div>;
  }
  return (
    <div className="mt-10">
      <button
        onClick={() => setShowAddFundingSource(!showAddFundingSource)}
        className=" text-white underline"
      >
        Add Funding Source
      </button>
      {showAddFundingSource && <AddFundingSourceForm />}
      <DataTable
        title="Funding Sources"
        columns={columns}
        data={fundingSources}
      />
    </div>
  );
};

const AddFundingSourceForm = () => {
  const [type, setType] = useState("");
  const [last4, setLast4] = useState("");
  const [defaultSource, setDefaultSource] = useState(false);
  const { addFundingSource } = useContext(PortfolioContext);

  const handleSubmit = (e) => {
    e.preventDefault();
    addFundingSource(type, last4, defaultSource);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col p-4 border">
      <PaymentCard />
      <button type="submit">Add Funding Source</button>
    </form>
  );
};

export default FundingSources;
