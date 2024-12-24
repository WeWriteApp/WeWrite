"use client";
import { useEffect, useState, createContext } from "react";

export const PortfolioContext = createContext();

export const PortfolioProvider = ({ children }) => {
  const [fundingSources, setFundingSources] = useState([
    {
      id: 1,
      type: "bank",
      last4: "1234",
      default: true,
    },
    {
      id: 2,
      type: "card",
      last4: "4321",
      default: false,
    },
  ]);
  const [fundingTransactions, setFundingTransactions] = useState([
    {
      id: "1",
      fundingSourceId: "1",
      amount: 1000,
      date: new Date(),
      type: "deposit",
      status: "completed",
    },
  ]);
  const [charges, setCharges] = useState([
    {
      id: 1,
      paidTo: "dFAKH3QHPID7TJCydfFf",
      amount: 10,
      date: new Date(new Date().setMonth(new Date().getMonth() - 1)),
      status: "paid",
    },
  ]);
  const [payouts, setPayouts] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [transactions, setTransactions] = useState([
    {
      id: 1,
      amount: 10,
      date: new Date(new Date().setDate(new Date().getDate() - 1)),
      status: "completed",
      paidTo: "ofUwv6uWwYWxnhbGCtbWPIg3yDt1",
      paidBy: "opFLqlfs5iTClRFDIKyyv07eKZn1",
      paidFor: "dFAKH3QHPID7TJCydfFf"
    },
    {
      id: 2,
      amount: 5,
      date: new Date(new Date().setDate(new Date().getDate() - 2)),
      status: "completed",
      paidTo: "ofUwv6uWwYWxnhbGCtbWPIg3yDt1",
      paidBy: "opFLqlfs5iTClRFDIKyyv07eKZn1",
      paidFor: "dFAKH3QHPID7TJCydfFf"
    }
  ]);
  const [totalSubscriptionsCost, setTotalSubscriptionsCost] = useState(0);
  const [remainingBalance, setRemainingBalance] = useState(0);

  const addFunding = (amount, fundingSourceId) => {
    setFundingTransactions([
      ...fundingTransactions,
      {
        id: fundingTransactions.length + 1,
        fundingSourceId,
        amount: amount,
        date: new Date(),
        type: "deposit",
        status: "completed",
      },
    ]);
    setRemainingBalance(parseInt(remainingBalance) + parseInt(amount));
  };

  const addFundingSource = (type, last4, defaultSource) => {
    setFundingSources([
      ...fundingSources,
      {
        id: fundingSources.length + 1,
        type,
        last4,
        default: defaultSource,
      },
    ]);
  };

  const removeSubscription = (id) => {
    setSubscriptions(
      subscriptions.map((sub) => {
        if (sub.id === id) {
          return {
            ...sub,
            status: "inactive",
          };
        }
        return sub;
      })
    );
  };

  const activateSubscription = (id) => {
    console.log("Activating subscription", id);
    setSubscriptions(
      subscriptions.map((sub) => {
        if (sub.id === id) {
          return {
            ...sub,
            status: "active",
          };
        }
        return sub;
      })
    );
  };

  const addSubscription = async (amount, id) => {
    try {
      const response = await fetch('/api/subscriptions/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': localStorage.getItem('stripe_customer_id') || '',
        },
        body: JSON.stringify({
          pageId: id,
          amount: amount,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update subscription');
      }

      const data = await response.json();

      if (data.subscription) {
        setSubscriptions(prevSubscriptions => {
          const existingIndex = prevSubscriptions.findIndex(sub => sub.id === id);
          if (existingIndex >= 0) {
            return prevSubscriptions.map((sub, index) =>
              index === existingIndex ? { ...sub, amount, status: 'active' } : sub
            );
          }
          return [...prevSubscriptions, {
            id,
            amount,
            date: new Date(),
            status: 'active',
          }];
        });
        setRemainingBalance(prev => prev - amount);
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  };

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch('/api/subscriptions/active', {
          headers: {
            'x-customer-id': localStorage.getItem('stripe_customer_id') || '',
          }
        });
        const data = await response.json();

        if (data.subscription) {
          setSubscriptions([data.subscription]);
          setTotalSubscriptionsCost(data.subscription.amount);
          setRemainingBalance(100 - data.subscription.amount);
        } else {
          setSubscriptions([]);
          setTotalSubscriptionsCost(0);
          setRemainingBalance(100);
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
      }
    };

    fetchSubscription();
  }, []);

  return (
    <PortfolioContext.Provider
      value={{
        fundingSources,
        fundingTransactions,
        charges,
        payouts,
        subscriptions,
        totalSubscriptionsCost,
        remainingBalance,
        addFunding,
        addFundingSource,
        removeSubscription,
        addSubscription,
        activateSubscription,
        transactions
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
};
