"use client";
import React, { useContext } from "react";
import { PortfolioContext } from "../../providers/PortfolioProvider";
import DataTable, { TableColumn } from "react-data-table-component";

interface Charge {
  id: string;
  paidTo: string;
  amount: number;
  date: string;
  status: string;
}

const ChargesTable: React.FC = () => {
  const { charges } = useContext(PortfolioContext);

  const columns: TableColumn<Charge>[] = [
    {
      name: "ID",
      selector: (row) => row.id,
      sortable: true
    },
    {
      name: "Paid To",
      selector: (row) => row.paidTo,
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
      cell: (row) => (
        <div>
          {new Date(row.date).toLocaleDateString()}
        </div>
      ),
      sortable: true
    },
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
      sortable: true
    },
  ];

  if (!charges) {
    return <div>Loading...</div>;
  }
  return (
    <div className="container mx-auto mb-0">
      <DataTable
        title="Charges"
        columns={columns}
        data={charges}
      />
    </div>
  );
};

export default ChargesTable;
