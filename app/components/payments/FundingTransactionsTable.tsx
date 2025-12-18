"use client";
import React, { useState, useContext, FormEvent, ChangeEvent } from "react";
import { PortfolioContext } from "../../providers/PortfolioProvider";
import DataTable, { TableColumn } from "react-data-table-component";

interface FundingTransaction {
  id: string;
  fundingSourceId: string;
  amount: number;
  date: string;
  status: string;
}

interface FundingSource {
  id: string;
  last4: string;
  type: string;
}

const FundingTransactionsTable: React.FC = () => {
  const { fundingTransactions } = useContext(PortfolioContext);
  const [showAddFunding, setShowAddFunding] = useState(false);

  const columns: TableColumn<FundingTransaction>[] = [
    {
      name: "ID",
      selector: (row) => row.id,
      sortable: true
    },
    {
      name: "Funding Source",
      selector: (row) => row.fundingSourceId,
      sortable: true
    },
    {
      name: "Amount",
      selector: (row) => row.amount,
      sortable: true
    },
    {
      name: "Date",
      selector: (row) => row.date,
      cell: (row) => <div>{new Date(row.date).toLocaleDateString()}</div>,
      sortable: true
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
      sortable: true
    },
  ];

  if (!fundingTransactions) {
    return <div>Loading...</div>;
  }
  return (
    <div className="pt-10 mb-0">
      <button
        className="text-black underline"
        onClick={() => setShowAddFunding(!showAddFunding)}
      >
        {showAddFunding ? "Close" : "Add Funding"}
      </button>
      {showAddFunding && <AddFundingForm />}
      <DataTable title="Funding Transactions" columns={columns} data={fundingTransactions} />
    </div>
  );
};

const AddFundingForm: React.FC = () => {
  const [amount, setAmount] = useState<number>(0);
  const { fundingSources, addFunding } = useContext(PortfolioContext);
  const [fundingSourceId, setFundingSourceId] = useState<string>("");

  const handleSubmit = (e: FormEvent<HTMLButtonElement>) => {
    e.preventDefault();
    addFunding(amount, fundingSourceId);
  };

  return (
    <form>
      <input
        type="number"
        value={amount}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(Number(e.target.value))}
        placeholder="Amount"
        className="border-theme-strong p-2"
        autoComplete="off"
      />
      <select
        value={fundingSourceId}
        className="border-theme-strong"
        onChange={(e: ChangeEvent<HTMLSelectElement>) => setFundingSourceId(e.target.value)}
      >
        <option value="">Select Funding Source</option>
        {fundingSources.map((source: FundingSource) => (
          <option key={source.id} value={source.id}>
            {source.last4} - {source.type}
          </option>
        ))}
      </select>
      <button
        className="bg-gray-200 text-black font-semibold py-2 px-4 rounded"
        onClick={handleSubmit}
      >
        Add Funding
      </button>
    </form>
  );
};

export default FundingTransactionsTable;
