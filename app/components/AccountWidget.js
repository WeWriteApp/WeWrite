import React, { useEffect, useState, useContext } from "react";
import { PortfolioContext } from "../providers/PortfolioProvider";
import SubscriptionsTable from "./SubscriptionsTable";

const AccountWidget = () => {
  const { totalSubscriptionsCost, remainingBalance } =
    useContext(PortfolioContext);

  return (
    <div className="flex flex-col mt-8 border p-4 w-full">
      <div className="flex items-center gap-2">
        <span className="text-gray-500">Total Subscriptions Cost:</span>
        <span className="text-gray-800 font-semibold">
          ${totalSubscriptionsCost}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-500">Remaining Balance:</span>
        <span className="text-gray-800 font-semibold">${remainingBalance}</span>
      </div>
      <SubscriptionsTable />
    </div>
  );
};

export default AccountWidget;
