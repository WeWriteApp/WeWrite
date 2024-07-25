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
  const [subscriptions, setSubscriptions] = useState([
    {
      id: "dFAKH3QHPID7TJCydfFf",
      amount: 10,
      // 3 days ago
      date: new Date(new Date().setDate(new Date().getDate() - 3)),
      status: "active",
    },
    {
      id: "AfVyQjm51Sl0CPT8qi7o",
      amount: 5,
      // 3 days ago
      date: new Date(new Date().setDate(new Date().getDate() - 3)),
      status: "active",
    },
  ]);
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
