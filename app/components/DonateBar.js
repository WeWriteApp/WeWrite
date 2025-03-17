"use client";
import React, { useState, useEffect, useContext } from "react";
import { PortfolioContext } from "../providers/PortfolioProvider";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Tooltip } from "react-tooltip";
import { useParams } from "next/navigation";
import { DrawerContext } from "../providers/DrawerProvider";
import SubscriptionsTable from "./SubscriptionsTable";
import { X, Pencil, Eye, Check, Minus, Plus, DollarSign } from "lucide-react";

const DonateBar = () => {
  const [donate, setDonate] = useState(0);
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

  useEffect(() => {
    if (id) {
      // if already subscribed
      const subscription = subscriptions.find((sub) => sub.id === id);
      if (subscription) {
       if (subscription.status === "active") {
          setIsSubscribed(true);
          setCurrentSubscription(subscription);
        } else {
          setIsSubscribed(false);
        }
      } else {
        setIsSubscribed(false);
      }
    }
  }, [subscriptions]);

  useEffect(() => {
    if (donate < 0) {
      setDonate(0);
    }
  }, [donate]);

  if (isSubscribed) {
    return (
      <>
        <div className="flex flex-col mt-8 fixed bottom-0 left-0 p-4 w-full align-items justify-center z-1">
          <div className="flex gap-4 mx-auto bg-background p-4 rounded">
            <button
              className="bg-background text-foreground px-4 py-2 rounded hover:bg-accent"
              data-tooltip-id="Unsubscribe"
              data-tooltip-place="top"
              data-tooltip-content={`Unsubscribe`}
              onClick={() => {
                removeSubscription(currentSubscription.id);
              }}
            >
              <X className="h-6 w-6" />
              <Tooltip id="Unsubscribe" place="top" />
            </button>

            {/* Edit button to view all subscriptions */}
            <button
              className="bg-background text-foreground px-4 py-2 rounded hover:bg-accent"
              data-tooltip-id="Edit"
              data-tooltip-place="top"
              data-tooltip-content={"Edit Pledge Amount"}
              onClick={() => setSelected(<SubscriptionsTable />)}
            >
              <Pencil className="h-6 w-6" />
              <Tooltip id="Edit" place="top" />
            </button>
            {/* eye button to view pledge history */}
            <button
              className="bg-background text-foreground px-4 py-2 rounded hover:bg-accent"
              data-tooltip-id="View"
              data-tooltip-place="top"
              data-tooltip-content={"View Pledge History"}
              onClick={() => setSelected(<SubscriptionsTable />)}
            >
              <Eye className="h-6 w-6" />
              <Tooltip id="View" place="top" />
            </button>

          </div>
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col mt-8 fixed bottom-0 left-0 p-4 w-full align-items justify-center z-1">
      {isConfirmed ? (
        <div className="flex gap-4 mx-auto bg-background p-4 rounded">
          <button
            className="bg-background text-foreground px-4 py-2 rounded hover:bg-accent"
            data-tooltip-id="Confirm"
            data-tooltip-place="top"
            data-tooltip-content={`Confirm ${donate}`}
            onClick={() => {
              addSubscription(donate, id);
            }}
          >
            <Check className="h-6 w-6" />
            <Tooltip id="Confirm" place="top" />
          </button>
          <button
            className="bg-background text-foreground px-4 py-2 rounded hover:bg-accent"
            data-tooltip-id="Cancel"
            data-tooltip-place="top"
            data-tooltip-content={"Cancel"}
            onClick={() => setIsConfirmed(false)}
          >
            <X className="h-6 w-6" />
            <Tooltip id="Cancel" place="top" />
          </button>
        </div>
      ) : (
        <div className="flex gap-4 mx-auto bg-background p-4 rounded">
          <button
            className="bg-background text-foreground px-4 py-2 rounded hover:bg-accent"
            data-tooltip-id="Donate"
            data-tooltip-place="top"
            data-tooltip-content={"Donate"}
            onClick={() => setIsConfirmed(true)}
          >
            <DollarSign className="h-6 w-6" />
            <Tooltip id="Donate" place="top" />
          </button>
        </div>
      )}

      <div className="flex gap-4 mx-auto bg-background p-4 rounded">
        <button
          className="bg-background text-foreground px-4 py-2 rounded hover:bg-accent"
          data-tooltip-id="Decrease"
          data-tooltip-place="top"
          data-tooltip-content={"Decrease"}
          onClick={() => setDonate(donate - 1)}
        >
          <Minus className="h-6 w-6" />
          <Tooltip id="Decrease" place="top" />
        </button>

        {/* Amount */}
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">{donate}</span>
          {/* <span className="text-gray-500">/mo</span> */}
        </div>

        {/* Increase */}
        <button
          className="bg-background text-foreground px-4 py-2 rounded hover:bg-accent"
          data-tooltip-id="Increase"
          data-tooltip-place="top"
          data-tooltip-content={"Increase"}
          onClick={() => setDonate(donate + 1)}
        >
          <Plus className="h-6 w-6" />
          <Tooltip id="Increase" place="top" />
        </button>
      </div>
    </div>
  );
};

export default DonateBar;
