"use client";
import React, { useEffect, useState } from "react";
import { useLedger } from "../providers/LedgerProvider";
import { useAuth } from "../providers/AuthProvider";
import { PillLink } from "./PillLink"; // Import the PillLink component

const centsToDollars = (cents) => (cents / 100).toFixed(2);

const SubscriptionsTable = () => {
  const { ledger, updateSubscription, getPageInfo } = useLedger();
  const [subscriptionsWithPages, setSubscriptionsWithPages] = useState([]);
  const [showAll, setShowAll] = useState(false); // State for filtering subscriptions
  const [totalBudget, setTotalBudget] = useState(0);
  const [usedBudget, setUsedBudget] = useState(0);
  const { user } = useAuth();
  useEffect(() => {
    const fetchSubscriptions = async () => {
      const enrichedSubscriptions = await Promise.all(
        ledger.map(async (subscription) => {
          const pageInfo = await getPageInfo(subscription.pageId);
          return {
            ...subscription,
            pageId: subscription.pageId,
            pageName: pageInfo?.title || "Unknown Page",
            isPublic: pageInfo?.isPublic || false,
          };
        })
      );
      setSubscriptionsWithPages(enrichedSubscriptions);
    };

    fetchSubscriptions();
  }, [ledger, getPageInfo]);

  useEffect(() => {
    if (!user) return;
    const tmpTotalBudget = user?.budget || 0;
    const tmpUsedBudget = subscriptionsWithPages.reduce(
      (total, { amount }) => total + (amount || 0),
      0
    );
    setTotalBudget(tmpTotalBudget);
    setUsedBudget(tmpUsedBudget);
  }, [user, subscriptionsWithPages]);

  const handleIncrement = (pageId, currentAmount, increment = 100) => {
    if (usedBudget + increment <= totalBudget) {
      const newAmount = currentAmount + increment;
      updateSubscription(pageId, { amount: newAmount });
    }
  };

  const handleDecrement = (pageId, currentAmount, decrement = 100) => {
    const newAmount = Math.max(0, currentAmount - decrement);
    updateSubscription(pageId, { amount: newAmount });
  };

  const filteredSubscriptions = showAll
    ? subscriptionsWithPages
    : subscriptionsWithPages.filter(({ amount }) => amount > 0);

  return (
    <div className="subscriptions-table mt-6">
      <h2 className="text-xl text-text font-bold">Subscriptions</h2>
      {/* Budget Metrics */}
      <BudgetMetrics totalBudget={totalBudget} usedBudget={usedBudget} />

      <div className="flex justify-between items-center mb-4">
        
        <button
          className={`text-text px-4 py-2 rounded ${
            showAll ? "bg-blue-500" : "bg-background"
          }`}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Hide $0 Subscriptions" : "Show $0 Subscriptions"}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {filteredSubscriptions.map(({ pageId,id, pageName, amount, isPublic }) => (
          <div key={pageId} className="flex items-center justify-between bg-background px-4 py-1 rounded-lg">
            {/* PillLink for the Page Name */}
            <PillLink href={`/pages/${pageId}`} isPublic={isPublic} groupId={pageId}>
              {pageName}
            </PillLink>
            {/* Increment, Balance, and Decrement Buttons */}
            <div className="flex items-center gap-2">
              <button
                className="bg-red-500 text-text px-3 py-1 rounded"
                onClick={() => handleDecrement(id, amount || 0)}
              >
                -
              </button>
              <div className="text-text text-lg font-medium">${centsToDollars(amount || 0)}</div>
              <button
                className="bg-green-500 text-text px-3 py-1 rounded"
                onClick={() => handleIncrement(id, amount || 0)}
                disabled={usedBudget + 100 > totalBudget}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const BudgetMetrics = ({ totalBudget, usedBudget }) => {
  const remainingBudget = totalBudget - usedBudget;

  return (
    <div className="budget-metrics mb-4 bg-background text-text p-4 rounded-lg flex justify-between items-center text-white">
      <div>
        <h3 className="text-lg font-bold">Total Budget:</h3>
        <p>${(totalBudget / 100).toFixed(2)}</p>
      </div>
      <div>
        <h3 className="text-lg font-bold">Used Budget:</h3>
        <p>${(usedBudget / 100).toFixed(2)}</p>
      </div>
      <div>
        <h3 className="text-lg font-bold">Remaining Budget:</h3>
        <p className={remainingBudget >= 0 ? "text-green-500" : "text-red-500"}>
          ${(remainingBudget / 100).toFixed(2)}
        </p>
      </div>
    </div>
  );
};

export default SubscriptionsTable;