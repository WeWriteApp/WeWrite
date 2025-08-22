"use client";
import React, { useContext, useEffect, useState } from "react";
import { PortfolioContext } from "../../providers/PortfolioProvider";
// Using API endpoints instead of direct Firebase calls
import PillLink from "../utils/PillLink";

import { useAuth } from "../../providers/AuthProvider";
const SubscriptionsTable = () => {
  const { user } = useAuth();
  // Payments feature is now always enabled - no conditional rendering needed
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
  const handleSaveChanges = () => {
    // Call the function to save updated subscriptions
    setChangesMade(false); // Reset changes state after saving
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
          className={`px-4 py-2 bg-primary text-white font-semibold rounded ${
            !changesMade ? "opacity-50 cursor-not-allowed" : "hover:bg-primary/90"
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
      // Use API endpoint to get page data
      fetch(`/api/pages/${id}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch page: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          setPage(data);
        })
        .catch(error => {
          console.error('Error fetching page:', error);
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
      <div className="flex items-center justify-between border-b-only py-4">
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