"use client";
import React, { useState, useEffect, useContext } from "react";
import { PortfolioContext } from "../providers/PortfolioProvider";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Tooltip } from "react-tooltip";
import { useParams } from "next/navigation";
import { DrawerContext } from "../providers/DrawerProvider";
import SubscriptionsTable from "./SubscriptionsTable";

const DonateBar = () => {
  const [donate, setDonate] = useState(0); // This is now a percentage
  const {
    totalSubscriptionsCost,
    remainingBalance,
    addSubscription,
    subscriptions,
    removeSubscription
  } = useContext(PortfolioContext);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const params = useParams();
  const id = params.id;
  const { setSelected } = useContext(DrawerContext);

  // Check for existing subscription
  useEffect(() => {
    if (id) {
      const subscription = subscriptions.find((sub) => sub.id === id);
      if (subscription) {
        if (subscription.status === "active") {
          setIsSubscribed(true);
          setCurrentSubscription(subscription);
          // Set initial percentage based on current subscription
          const total = totalSubscriptionsCost || 10;
          setDonate((subscription.amount / total) * 100);
        } else {
          setIsSubscribed(false);
        }
      } else {
        setIsSubscribed(false);
      }
    }
  }, [subscriptions, id, totalSubscriptionsCost]);

  // Ensure donate stays within 0-100%
  useEffect(() => {
    if (donate < 0) {
      setDonate(0);
    } else if (donate > 100) {
      setDonate(100);
    }
  }, [donate]);

  // Format amount for display
  const formatAmount = (percentage) => {
    const total = totalSubscriptionsCost || 10;
    return ((percentage / 100) * total).toFixed(2);
  };

  if (isSubscribed) {
    return (
      <div className="flex flex-col mt-8 fixed bottom-0 left-0 p-4 w-full align-items justify-center z-1">
        <div className="flex gap-4 mx-auto bg-slate-50 p-4 rounded">
          <button
            className="bg-gray-100 text-gray-600 px-4 py-2 rounded hover:bg-gray-200"
            data-tooltip-id="Unsubscribe"
            data-tooltip-place="top"
            data-tooltip-content={`Unsubscribe ($${formatAmount(donate)}/mo)`}
            onClick={() => {
              removeSubscription(currentSubscription.id);
            }}
          >
            <Icon icon="mdi:close" width="24" height="24" />
            <Tooltip id="Unsubscribe" place="top" />
          </button>

          <button
            className="bg-gray-100 text-gray-600 px-4 py-2 rounded hover:bg-gray-200"
            data-tooltip-id="Edit"
            data-tooltip-place="top"
            data-tooltip-content={`Edit Pledge Amount (${donate.toFixed(1)}%)`}
            onClick={() => setSelected(<SubscriptionsTable />)}
          >
            <Icon icon="mdi:pencil" width="24" height="24" />
            <Tooltip id="Edit" place="top" />
          </button>

          <button
            className="bg-gray-100 text-gray-600 px-4 py-2 rounded hover:bg-gray-200"
            data-tooltip-id="View"
            data-tooltip-place="top"
            data-tooltip-content={"View Pledge History"}
            onClick={() => setSelected(<SubscriptionsTable />)}
          >
            <Icon icon="mdi:eye" width="24" height="24" />
            <Tooltip id="View" place="top" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col mt-8 fixed bottom-0 left-0 p-4 w-full align-items justify-center z-1">
      {isConfirmed ? (
        <div className="flex gap-4 mx-auto bg-slate-50 p-4 rounded">
          <button
            className="bg-gray-100 text-gray-600 px-4 py-2 rounded hover:bg-gray-200"
            data-tooltip-id="Confirm"
            data-tooltip-place="top"
            data-tooltip-content={`Pledge ${donate.toFixed(1)}% ($${formatAmount(donate)}/mo)`}
            onClick={() => {
              const amount = (donate / 100) * (totalSubscriptionsCost || 10);
              addSubscription(amount, id);
            }}
          >
            <Icon icon="mdi:check" width="24" height="24" />
            <Tooltip id="Confirm" place="top" />
          </button>
          <button
            className="bg-gray-100 text-gray-600 px-4 py-2 rounded hover:bg-gray-200"
            data-tooltip-id="Cancel"
            data-tooltip-place="top"
            data-tooltip-content={"Cancel"}
            onClick={() => setIsConfirmed(false)}
          >
            <Icon icon="mdi:close" width="24" height="24" />
            <Tooltip id="Cancel" place="top" />
          </button>
        </div>
      ) : (
        <div className="flex gap-4 mx-auto bg-slate-50 p-4 rounded">
          <button
            className="bg-gray-100 text-gray-600 px-4 py-2 rounded hover:bg-gray-200"
            data-tooltip-id="Donate"
            data-tooltip-place="top"
            data-tooltip-content={`Pledge ${donate.toFixed(1)}% ($${formatAmount(donate)}/mo)`}
            onClick={() => setIsConfirmed(true)}
          >
            <Icon icon="mdi:cash" width="24" height="24" />
            <Tooltip id="Donate" place="top" />
          </button>
        </div>
      )}

      <div className="flex gap-4 mx-auto bg-slate-50 p-4 rounded">
        <button
          className="bg-gray-100 text-gray-600 px-4 py-2 rounded hover:bg-gray-200"
          data-tooltip-id="Decrease"
          data-tooltip-place="top"
          data-tooltip-content={`Decrease by 5% (-$${formatAmount(5)})`}
          onClick={() => setDonate(Math.max(0, donate - 5))}
        >
          <Icon icon="mdi:minus" width="24" height="24" />
          <Tooltip id="Decrease" place="top" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">{donate.toFixed(1)}%</span>
          <span className="text-gray-500">${formatAmount(donate)}/mo</span>
        </div>

        <button
          className="bg-gray-100 text-gray-600 px-4 py-2 rounded hover:bg-gray-200"
          data-tooltip-id="Increase"
          data-tooltip-place="top"
          data-tooltip-content={`Increase by 5% (+$${formatAmount(5)})`}
          onClick={() => setDonate(Math.min(100, donate + 5))}
        >
          <Icon icon="mdi:plus" width="24" height="24" />
          <Tooltip id="Increase" place="top" />
        </button>
      </div>
    </div>
  );
};

export default DonateBar;
