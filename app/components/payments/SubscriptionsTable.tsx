"use client";
import React, { useContext, useEffect, useState, Dispatch, SetStateAction } from "react";
import { PortfolioContext } from "../../providers/PortfolioProvider";
import PillLink from "../utils/PillLink";

import { useAuth } from "../../providers/AuthProvider";

interface Subscription {
  id: string;
  amount: number;
}

interface Page {
  id: string;
  title: string;
  isPublic?: boolean;
}

interface SubscriptionItemProps {
  subscription: Subscription;
  index: number;
  localSubscriptions: Subscription[];
  setLocalSubscriptions: Dispatch<SetStateAction<Subscription[]>>;
  setChangesMade: Dispatch<SetStateAction<boolean>>;
}

interface SubscriptionAmountProps {
  amount: number;
  handleAmountChange: (change: number) => void;
}

const SubscriptionsTable: React.FC = () => {
  const { user } = useAuth();
  const { subscriptions } = useContext(PortfolioContext);

  const [localSubscriptions, setLocalSubscriptions] = useState<Subscription[]>([]);
  const [changesMade, setChangesMade] = useState(false);

  useEffect(() => {
    if (subscriptions) {
      setLocalSubscriptions(subscriptions);
    }
  }, [subscriptions]);

  const handleSaveChanges = () => {
    setChangesMade(false);
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

const SubscriptionItem: React.FC<SubscriptionItemProps> = ({
  subscription,
  index,
  localSubscriptions,
  setLocalSubscriptions,
  setChangesMade
}) => {
  const { id, amount } = subscription;
  const [page, setPage] = useState<Page | null>(null);

  useEffect(() => {
    if (!id) return;
    if (!page) {
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

  const handleAmountChange = (change: number) => {
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

const SubscriptionAmount: React.FC<SubscriptionAmountProps> = ({ amount, handleAmountChange }) => {
  return (
    <div className="flex items-center space-x-4">
      <button
        className="flex items-center justify-center w-8 h-8 bg-background--light text-text rounded-sm border-border border"
        onClick={() => handleAmountChange(-1)}
      >
        &#8211;
      </button>

      <span className="text-text text-lg font-medium">${amount}/mo</span>

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
