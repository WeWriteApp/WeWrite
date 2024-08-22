"use client";
import React, { useEffect, useState, useContext } from "react";
import { PortfolioContext } from "../providers/PortfolioProvider";
import DashboardLayout from "../DashboardLayout";
import FundingSources from "../components/FundingSources";
import SubscriptionsTable from "../components/SubscriptionsTable";
import ChargesTable from "../components/ChargesTable";
import PayoutsTable from "../components/PayoutsTable";
import FundingTransactionsTable from "../components/FundingTransactionsTable";

const Page = () => {
  const { totalSubscriptionsCost, remainingBalance } = useContext(PortfolioContext);
  
  return (
    <DashboardLayout>
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>

        <div className="flex w-full h-1 bg-gray-200 my-4"></div> 
          <p>{totalSubscriptionsCost}</p>
          <p>{remainingBalance}</p>
        <div className="flex flex-col w-full">
          <FundingSources />
          <FundingTransactionsTable />
          <ChargesTable />
          <SubscriptionsTable />
          <PayoutsTable />
        </div>
      </div>
    </DashboardLayout>
  );
};



export default Page;
