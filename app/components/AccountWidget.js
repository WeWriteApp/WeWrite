"use client";
import React, { useEffect, useState, useContext } from "react";
import { PortfolioContext } from "../providers/PortfolioProvider";
import SubscriptionsTable from "./SubscriptionsTable";

const AccountWidget = () => {
  const { totalSubscriptionsCost, remainingBalance } =
    useContext(PortfolioContext);

  return (
    <div className="flex flex-col mt-4 md:mt-8 border p-4 w-full">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Total funds for the month</h2>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-500">Total Allocated</span>
        <span className="text-gray-800 font-semibold">
          ${totalSubscriptionsCost}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-500">Remaining Budget for the month:</span>
        <span className="text-gray-800 font-semibold">${remainingBalance}</span>
      </div>
    </div>
  );
};

export default AccountWidget;
