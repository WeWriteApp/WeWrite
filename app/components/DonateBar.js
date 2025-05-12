"use client";
import React, { useState, useEffect, useContext, use } from "react";
import { PortfolioContext } from "../providers/PortfolioProvider";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Tooltip } from "react-tooltip";
import { useParams } from "next/navigation";
import { DrawerContext } from "../providers/DrawerProvider";
import SubscriptionsTable from "./SubscriptionsTable";
import { X, Pencil, Eye, Check, Minus, Plus, DollarSign } from "lucide-react";
import { Button } from "./ui/button";

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
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const id = resolvedParams.id;
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
            <Button
              variant="outline"
              size="icon"
              data-tooltip-id="Unsubscribe"
              data-tooltip-place="top"
              data-tooltip-content={`Unsubscribe`}
              onClick={() => {
                removeSubscription(currentSubscription.id);
              }}
            >
              <X className="h-6 w-6" />
              <Tooltip id="Unsubscribe" place="top" />
            </Button>

            {/* Edit button to view all subscriptions */}
            <Button
              variant="outline"
              size="icon"
              data-tooltip-id="Edit"
              data-tooltip-place="top"
              data-tooltip-content={"Edit Pledge Amount"}
              onClick={() => setSelected(<SubscriptionsTable />)}
            >
              <Pencil className="h-6 w-6" />
              <Tooltip id="Edit" place="top" />
            </Button>
            {/* eye button to view pledge history */}
            <Button
              variant="outline"
              size="icon"
              data-tooltip-id="View"
              data-tooltip-place="top"
              data-tooltip-content={"View Pledge History"}
              onClick={() => setSelected(<SubscriptionsTable />)}
            >
              <Eye className="h-6 w-6" />
              <Tooltip id="View" place="top" />
            </Button>

          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Gradient background at the bottom, behind the bar */}
      <div
        className="fixed left-0 right-0 bottom-0 w-full h-64 z-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.25) 60%, rgba(0,0,0,0) 100%)',
        }}
      />
      {/* Floating pledge bar */}
      <div
        className="fixed left-1/2 bottom-16 transform -translate-x-1/2 z-10 w-full max-w-md px-4"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="w-full bg-white/80 dark:bg-zinc-900/80 rounded-2xl shadow-2xl flex flex-col items-center justify-center py-3 px-4 backdrop-blur-lg border border-black/20 dark:border-white/20">
          {isConfirmed ? (
            <div className="flex gap-4 mx-auto">
              <Button
                variant="outline"
                size="icon"
                data-tooltip-id="Confirm"
                data-tooltip-place="top"
                data-tooltip-content={`Confirm ${donate}`}
                onClick={() => {
                  addSubscription(donate, id);
                }}
              >
                <Check className="h-6 w-6" />
                <Tooltip id="Confirm" place="top" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                data-tooltip-id="Cancel"
                data-tooltip-place="top"
                data-tooltip-content={"Cancel"}
                onClick={() => setIsConfirmed(false)}
              >
                <X className="h-6 w-6" />
                <Tooltip id="Cancel" place="top" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-4 mx-auto">
              <Button
                variant="outline"
                size="icon"
                data-tooltip-id="Donate"
                data-tooltip-place="top"
                data-tooltip-content={"Donate"}
                onClick={() => setIsConfirmed(true)}
              >
                <DollarSign className="h-6 w-6" />
                <Tooltip id="Donate" place="top" />
              </Button>
            </div>
          )}
          <div className="flex gap-4 mx-auto mt-2">
            <Button
              variant="outline"
              size="icon"
              data-tooltip-id="Decrease"
              data-tooltip-place="top"
              data-tooltip-content={"Decrease"}
              onClick={() => setDonate(donate - 1)}
            >
              <Minus className="h-6 w-6" />
              <Tooltip id="Decrease" place="top" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{donate}</span>
              {/* <span className="text-gray-500">/mo</span> */}
            </div>
            <Button
              variant="outline"
              size="icon"
              data-tooltip-id="Increase"
              data-tooltip-place="top"
              data-tooltip-content={"Increase"}
              onClick={() => setDonate(donate + 1)}
            >
              <Plus className="h-6 w-6" />
              <Tooltip id="Increase" place="top" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DonateBar;
