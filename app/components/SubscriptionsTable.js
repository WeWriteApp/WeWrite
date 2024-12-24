"use client";
import React, { useContext, useEffect, useState } from "react";
import { PortfolioContext } from "../providers/PortfolioProvider";
import { getPageById } from "../firebase/database";
import {PillLink} from "./PillLink";

const SubscriptionsTable = () => {
  const { subscriptions } = useContext(PortfolioContext);

  // Local copy of subscriptions for editing
  const [localSubscriptions, setLocalSubscriptions] = useState([]);
  const [changesMade, setChangesMade] = useState(false);

  // Initialize the local subscriptions with the context subscriptions
  useEffect(() => {
    if (subscriptions) {
      setLocalSubscriptions(subscriptions);
    }
  }, [subscriptions]);

  // Function to handle saving changes
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
            amount: sub.amount
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

      {/* Save Changes Button */}
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
  const { id, amount } = subscription;
  const [page, setPage] = useState(null);
  const { subscriptions } = useContext(PortfolioContext);

  useEffect(() => {
    if (!id) return;
    if (!page) {
      getPageById(id).then((data) => {
        setPage(data.pageData);
      });
    }
  }, [id, page]);

  const handleAmountChange = (change) => {
    const updatedSubscriptions = [...localSubscriptions];
    updatedSubscriptions[index].amount = Math.max(0, updatedSubscriptions[index].amount + change);
    setLocalSubscriptions(updatedSubscriptions);
    setChangesMade(true);
  };

  if (!page) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-200 py-4">
        <PillLink href={`/pages/${page.id}`} isPublic={page.isPublic}>
          {page.title}
        </PillLink>
        <SubscriptionAmount amount={subscription.amount} handleAmountChange={handleAmountChange} />
      </div>
    </>
  );
};

const SubscriptionAmount = ({ amount, handleAmountChange }) => {
  return (
    <div className="flex items-center space-x-4">
      {/* Decrement Button */}
      <button
        className="flex items-center justify-center w-8 h-8 bg-background--light text-text rounded-sm border-border border"
        onClick={() => handleAmountChange(-1)}
      >
        &#8211; {/* HTML entity for dash/minus */}
      </button>

      {/* Amount Display */}
      <span className="text-text text-lg font-medium">${amount}/mo</span>

      {/* Increment Button */}
      <button
        className="flex items-center justify-center w-8 h-8 bg-background--light text-text rounded-sm border-border border"
        onClick={() => handleAmountChange(1)}
      >
        +
      </button>
    </div>
  );
};

export default SubscriptionsTable;
