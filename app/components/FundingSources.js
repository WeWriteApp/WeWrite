"use client";
import React, { useEffect, useState, useContext } from "react";
import { PortfolioContext } from "../providers/PortfolioProvider";
import DataTable from "react-data-table-component";
import { Icon } from "@iconify/react/dist/iconify.js";

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
    <div className="container mx-auto pt-10 mb-0">
      <button
        onClick={() => setShowAddFundingSource(!showAddFundingSource)}
        className=" text-black underline"
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
      <div className="flex flex-col">
        <label htmlFor="type">Type</label>
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mb-2 border p-2"
        >
          <option value="">Select type</option>
          <option value="card">Card</option>
          <option value="bank">Bank</option>
        </select>
      </div>
      <div className="flex flex-col">
        <label htmlFor="last4">Last 4</label>
        <input
          type="text"
          id="last4"
          className="mb-2 border p-2"
          value={last4}
          onChange={(e) => setLast4(e.target.value)}
        />
      </div>
      <div className="flex flex-row items-start">
        <input
          className="mb-2"
          type="checkbox"
          id="default"
          value={defaultSource}
          onChange={(e) => setDefaultSource(e.target.checked)}
        />
        <label htmlFor="default">Default</label>
      </div>
      <button type="submit">Add Funding Source</button>
    </form>
  );
};

export default FundingSources;
