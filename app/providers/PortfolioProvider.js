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
  const [totalAllocatedPercentage, setTotalAllocatedPercentage] = useState(0);

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

  const addSubscription = async (pageId, amount, percentage) => {
    try {
      console.log('Adding subscription:', { pageId, amount, percentage });
      const response = await fetch('/api/subscriptions/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': localStorage.getItem('stripe_customer_id') || '',
        },
        body: JSON.stringify({
          pageId,
          percentage,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update subscription');
      }

      const data = await response.json();

      if (data.subscription) {
        setSubscriptions(prevSubscriptions => {
          const existingIndex = prevSubscriptions.findIndex(sub => sub.id === pageId);
          const newSubscription = {
            id: pageId,
            amount: data.subscription.amount,
            percentage: data.subscription.percentage,
            date: new Date(),
            status: 'active',
          };

          const otherSubscriptionsTotal = prevSubscriptions.reduce((total, sub) =>
            sub.id !== pageId ? total + (sub.percentage || 0) : total, 0);

          if (otherSubscriptionsTotal + percentage > 100) {
            throw new Error('Total allocation cannot exceed 100%');
          }

          setTotalAllocatedPercentage(otherSubscriptionsTotal + percentage);

          if (existingIndex >= 0) {
            return prevSubscriptions.map((sub, index) =>
              index === existingIndex ? newSubscription : sub
            );
          }
          return [...prevSubscriptions, newSubscription];
        });
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  };

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        console.log('Fetching subscription data...');
        const customerId = localStorage.getItem('stripe_customer_id');
        console.log('Customer ID:', customerId);

        if (!customerId) {
          console.log('No customer ID found, using default values');
          setSubscriptions([]);
          setTotalSubscriptionsCost(0);
          setRemainingBalance(10);
          setTotalAllocatedPercentage(0);
          return;
        }

        const response = await fetch('/api/subscriptions/active', {
          headers: {
            'x-customer-id': customerId,
          }
        });
        const data = await response.json();
        console.log('Subscription data received:', data);

        if (data.subscriptions && data.subscriptions.length > 0) {
          console.log('Setting active subscriptions:', data.subscriptions);
          setSubscriptions(data.subscriptions.map(sub => ({
            ...sub,
            status: 'active'
          })));

          const totalCost = data.subscriptions.reduce((total, sub) => total + (sub.amount || 0), 0);
          const totalPercentage = data.subscriptions.reduce((total, sub) => total + (sub.percentage || 0), 0);

          setTotalSubscriptionsCost(totalCost);
          setTotalAllocatedPercentage(totalPercentage);
          setRemainingBalance(10 - totalCost);
        } else {
          console.log('No active subscriptions found, using default values');
          setSubscriptions([]);
          setTotalSubscriptionsCost(0);
          setRemainingBalance(10);
          setTotalAllocatedPercentage(0);
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
        setSubscriptions([]);
        setTotalSubscriptionsCost(0);
        setRemainingBalance(10);
        setTotalAllocatedPercentage(0);
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
        totalAllocatedPercentage,
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
