"use client";
import React, { useState, useContext, FormEvent, ChangeEvent } from "react";
import { PortfolioContext } from "../../providers/PortfolioProvider";
import DataTable, { TableColumn } from "react-data-table-component";
import { Check, X } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

interface FundingSource {
  id: string;
  type: string;
  last4: string;
  default: boolean;
}

const FundingSources: React.FC = () => {
  const { fundingSources } = useContext(PortfolioContext);
  const [showAddFundingSource, setShowAddFundingSource] = useState(false);

  const columns: TableColumn<FundingSource>[] = [
    {
      name: "Type",
      selector: (row) => row.type,
      sortable: true
    },
    {
      name: "Last 4",
      selector: (row) => row.last4,
      sortable: true
    },
    {
      name: "Default",
      selector: (row) => row.default,
      cell: (row) => (
        <div>
          {row.default ? (
            <Check className="h-5 w-5 text-green-500" />
          ) : (
            <X className="h-5 w-5 text-red-500" />
          )}
        </div>
      ),
      sortable: true
    },
  ];

  if (!fundingSources) {
    return <div>Loading...</div>;
  }
  return (
    <div className="mt-10">
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

const AddFundingSourceForm: React.FC = () => {
  const [type, setType] = useState("");
  const [last4, setLast4] = useState("");
  const [defaultSource, setDefaultSource] = useState(false);
  const { addFundingSource } = useContext(PortfolioContext);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
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
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setType(e.target.value)}
          className="wewrite-input mb-2"
        >
          <option value="">Select type</option>
          <option value="card">Card</option>
          <option value="bank">Bank</option>
        </select>
      </div>
      <div className="flex flex-col">
        <label htmlFor="last4">Last 4</label>
        <Input
          type="text"
          id="last4"
          className="mb-2"
          value={last4}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setLast4(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="flex flex-row items-start">
        <input
          className="mb-2"
          type="checkbox"
          id="default"
          checked={defaultSource}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setDefaultSource(e.target.checked)}
          autoComplete="off"
        />
        <label htmlFor="default">Default</label>
      </div>
      <Button type="submit">Add Funding Source</Button>
    </form>
  );
};

export default FundingSources;
