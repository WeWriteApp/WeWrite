"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
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
      // date 1 month ago
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
  const [totalSubscriptionsCost, setTotalSubscriptionsCost] = useState(15);
  const [remainingBalance, setRemainingBalance] = useState(985);

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
    // set to inactive
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
    // set to active
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

  const addSubscription = (amount, id) => {
    //  check if the subscription already exists, if it is does activate it and set the amount
    //  if it does not exist, add it
    const subscription = subscriptions.find((sub) => sub.id === id);
    if (subscription) {
      // activateSubscription(id);
      setSubscriptions(
        subscriptions.map((sub) => {
          if (sub.id === id) {
            return {
              ...sub,
              status: "active",
              amount: amount,
            };
          }
          return sub;
        })
      );
    } else {
      setSubscriptions([
        ...subscriptions,
        {
          id,
          amount,
          date: new Date(),
          status: "active",
        },
      ]);
    }
    setRemainingBalance(parseInt(remainingBalance) - parseInt(amount));
  };

  // Fetch real subscription status from backend on mount, but only once
  useEffect(() => {
    // Use a flag in localStorage to prevent repeated subscription checks
    const lastSubscriptionCheck = localStorage.getItem('lastSubscriptionCheck');
    const now = Date.now();
    const checkInterval = 3600000; // 1 hour in milliseconds

    // Only check if we haven't checked in the last hour
    if (!lastSubscriptionCheck || (now - parseInt(lastSubscriptionCheck)) > checkInterval) {
      async function fetchSubscription() {
        try {
          // Check if the user is authenticated before making the API call
          const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
          if (!isAuthenticated) {
            console.log('User not authenticated, skipping subscription check');
            return;
          }

          const res = await fetch("/api/account-subscription", {
            // Add error handling options
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            // Don't follow redirects to avoid issues with auth
            redirect: 'error',
          });

          if (res.ok) {
            const data = await res.json();
            if (data && data.status) {
              setSubscriptions([{ ...data }]);
            } else {
              setSubscriptions([]);
            }
            // Update the last check timestamp
            localStorage.setItem('lastSubscriptionCheck', now.toString());
          } else if (res.status === 401) {
            // Handle unauthorized error gracefully
            console.log('User not authorized for subscription check');
            setSubscriptions([]);
          } else {
            console.error('Error fetching subscription data:', res.status);
            setSubscriptions([]);
          }
        } catch (e) {
          console.error('Exception in subscription check:', e);
          setSubscriptions([]);
          // Don't update the timestamp on error so we can retry later
        }
      }

      // Wrap in try/catch to prevent any errors from breaking the app
      try {
        fetchSubscription();
      } catch (error) {
        console.error('Failed to fetch subscription:', error);
      }
    }
  }, []);

  useEffect(() => {
    // calculate based on active
    const activeSubscriptions = subscriptions.filter(
      (sub) => sub.status === "active"
    );

    const total = activeSubscriptions.reduce((acc, sub) => {
      return acc + sub.amount;
    }, 0);

    setTotalSubscriptionsCost(total);
  }, [subscriptions]);

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
