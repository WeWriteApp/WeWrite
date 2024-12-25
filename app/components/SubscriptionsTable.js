"use client";
import React, { useContext, useEffect, useState } from "react";
import { PortfolioContext } from "../providers/PortfolioProvider";
import { getPageById } from "../firebase/database";
import { PillLink } from "./PillLink";

const SubscriptionsTable = () => {
  const { subscriptions, totalSubscriptionsCost } = useContext(PortfolioContext);
  const [localSubscriptions, setLocalSubscriptions] = useState([]);
  const [changesMade, setChangesMade] = useState(false);
  const [totalPercentage, setTotalPercentage] = useState(0);

  useEffect(() => {
    if (subscriptions) {
      setLocalSubscriptions(subscriptions);
      const total = subscriptions.reduce((sum, sub) => sum + (sub.percentage || 0), 0);
      setTotalPercentage(total);
    }
  }, [subscriptions]);

  const handleSaveChanges = async () => {
    try {
      const customerId = localStorage.getItem('stripe_customer_id');
      if (!customerId) {
        console.error('No customer ID found');
        return;
      }

      const promises = localSubscriptions.map(sub =>
        fetch('/api/subscriptions/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-customer-id': customerId
          },
          body: JSON.stringify({
            pageId: sub.id,
            percentage: sub.percentage
          })
        })
      );
      await Promise.all(promises);
      setChangesMade(false);
    } catch (error) {
      console.error('Error saving subscription changes:', error);
    }
  };

  if (!localSubscriptions) {
    return <div>Loading...</div>;
  }

  return (
    <div className="mb-0">
      <div className="mb-4 text-sm font-medium">
        Total Allocated: {totalPercentage.toFixed(1)}%
        {totalPercentage > 100 && (
          <span className="text-red-500 ml-2">
            Warning: Total allocation exceeds 100%
          </span>
        )}
      </div>

      {localSubscriptions.length > 0 ? (
        localSubscriptions.map((subscription, index) => (
          <SubscriptionItem
            key={subscription.id}
            subscription={subscription}
            index={index}
            localSubscriptions={localSubscriptions}
            setLocalSubscriptions={setLocalSubscriptions}
            setChangesMade={setChangesMade}
          />
        ))
      ) : (
        <div>No subscriptions available.</div>
      )}

      <div className="pt-4">
        <button
          className={`px-4 py-2 bg-blue-600 text-white font-semibold rounded ${
            !changesMade ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"
          }`}
          disabled={!changesMade}
          onClick={handleSaveChanges}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

const SubscriptionItem = ({
  subscription,
  index,
  localSubscriptions,
  setLocalSubscriptions,
  setChangesMade
}) => {
  const { id, percentage = 0 } = subscription;
  const [page, setPage] = useState(null);
  const { totalSubscriptionsCost } = useContext(PortfolioContext);
  const baseAmount = 10;

  useEffect(() => {
    if (!id) return;
    if (!page) {
      getPageById(id).then((data) => {
        setPage(data.pageData);
      });
    }
  }, [id, page]);

  const handlePercentageChange = (change) => {
    const updatedSubscriptions = [...localSubscriptions];
    const newPercentage = Math.max(0, Math.min(100, updatedSubscriptions[index].percentage + change));
    updatedSubscriptions[index].percentage = newPercentage;
    updatedSubscriptions[index].amount = (baseAmount * newPercentage) / 100;
    setLocalSubscriptions(updatedSubscriptions);
    setChangesMade(true);
  };

  if (!page) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex items-center justify-between border-b border-gray-200 py-4">
      <PillLink href={`/pages/${page.id}`} isPublic={page.isPublic}>
        {page.title}
      </PillLink>
      <SubscriptionAmount
        percentage={percentage}
        handlePercentageChange={handlePercentageChange}
        amount={(baseAmount * percentage) / 100}
      />
    </div>
  );
};

const SubscriptionAmount = ({ percentage, handlePercentageChange, amount }) => {
  return (
    <div className="flex items-center space-x-4">
      <button
        className="flex items-center justify-center w-8 h-8 bg-background--light text-text rounded-sm border-border border"
        onClick={() => handlePercentageChange(-5)}
      >
        &#8211;
      </button>

      <div className="flex flex-col items-end">
        <span className="text-text text-lg font-medium">{percentage.toFixed(1)}%</span>
        <span className="text-sm text-gray-500">${amount.toFixed(2)}/mo</span>
      </div>

      <button
        className="flex items-center justify-center w-8 h-8 bg-background--light text-text rounded-sm border-border border"
        onClick={() => handlePercentageChange(5)}
      >
        +
      </button>
    </div>
  );
};

export default SubscriptionsTable;
