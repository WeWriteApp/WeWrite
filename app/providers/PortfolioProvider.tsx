"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useEffect, useState, createContext, ReactNode } from "react";

// Types
interface FundingSource {
  id: number;
  type: "bank" | "card";
  last4: string;
  default: boolean;
}

interface FundingTransaction {
  id: string | number;
  fundingSourceId: string | number;
  amount: number;
  date: Date;
  type: "deposit" | "withdrawal";
  status: "completed" | "pending" | "failed";
}

interface Charge {
  id: number;
  paidTo: string;
  amount: number;
  date: Date;
  status: "paid" | "pending" | "failed";
}

interface Transaction {
  id: number;
  amount: number;
  date: Date;
  status: "completed" | "pending" | "failed";
  paidTo: string;
  paidBy: string;
  paidFor: string;
}

interface Subscription {
  id: string | number;
  amount: number;
  date: Date;
  status: "active" | "inactive";
}

interface PortfolioContextType {
  fundingSources: FundingSource[];
  fundingTransactions: FundingTransaction[];
  charges: Charge[];
  payouts: any[];
  subscriptions: Subscription[];
  totalSubscriptionsCost: number;
  remainingBalance: number;
  addFunding: (amount: number, fundingSourceId: string | number) => void;
  addFundingSource: (type: "bank" | "card", last4: string, defaultSource: boolean) => void;
  removeSubscription: (id: string | number) => void;
  addSubscription: (amount: number, id: string | number) => void;
  activateSubscription: (id: string | number) => void;
  transactions: Transaction[];
}

interface PortfolioProviderProps {
  children: ReactNode;
}

export const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const PortfolioProvider = ({ children }: PortfolioProviderProps) => {
  const [fundingSources, setFundingSources] = useState<FundingSource[]>([
    {
      id: 1,
      type: "bank",
      last4: "1234",
      default: true},
    {
      id: 2,
      type: "card",
      last4: "4321",
      default: false},
  ]);
  const [fundingTransactions, setFundingTransactions] = useState<FundingTransaction[]>([
    {
      id: "1",
      fundingSourceId: "1",
      amount: 1000,
      date: new Date(),
      type: "deposit",
      status: "completed"},
  ]);
  const [charges, setCharges] = useState<Charge[]>([
    {
      id: 1,
      paidTo: "dFAKH3QHPID7TJCydfFf",
      amount: 10,
      // date 1 month ago
      date: new Date(new Date().setMonth(new Date().getMonth() - 1)),
      status: "paid"},
  ]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([
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
  const [totalSubscriptionsCost, setTotalSubscriptionsCost] = useState<number>(15);
  const [remainingBalance, setRemainingBalance] = useState<number>(985);

  const addFunding = (amount: number, fundingSourceId: string | number): void => {
    setFundingTransactions([
      ...fundingTransactions,
      {
        id: fundingTransactions.length + 1,
        fundingSourceId,
        amount: amount,
        date: new Date(),
        type: "deposit",
        status: "completed"},
    ]);
    setRemainingBalance(parseInt(remainingBalance.toString()) + parseInt(amount.toString()));
  };

  const addFundingSource = (type: "bank" | "card", last4: string, defaultSource: boolean): void => {
    setFundingSources([
      ...fundingSources,
      {
        id: fundingSources.length + 1,
        type,
        last4,
        default: defaultSource},
    ]);
  };

  const removeSubscription = (id: string | number): void => {
    // set to inactive
    setSubscriptions(
      subscriptions.map((sub) => {
        if (sub.id === id) {
          return {
            ...sub,
            status: "inactive" as const};
        }
        return sub;
      })
    );
  };

  const activateSubscription = (id: string | number): void => {
    // set to active
    setSubscriptions(
      subscriptions.map((sub) => {
        if (sub.id === id) {
          return {
            ...sub,
            status: "active" as const};
        }
        return sub;
      })
    );
  };

  const addSubscription = (amount: number, id: string | number): void => {
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
              status: "active" as const,
              amount: amount};
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
          status: "active" as const},
      ]);
    }
    setRemainingBalance(parseInt(remainingBalance.toString()) - parseInt(amount.toString()));
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
            return;
          }

          // Subscription feature is now always enabled
          const subscriptionEnabled = true;

          // Only fetch subscription data if the feature is enabled
          if (subscriptionEnabled) {
            try {
              // Use optimized Firebase function for subscription data
              // Use API-first approach instead of complex optimized subscription
              const response = await fetch('/api/account-subscription');
              const data = response.ok ? await response.json() : null;
              const subscriptionData = data?.hasSubscription ? data.fullData : null;

              if (subscriptionData && subscriptionData.status) {
                setSubscriptions([{ ...subscriptionData }]);
              } else {
                setSubscriptions([]);
              }
              // Update the last check timestamp
              localStorage.setItem('lastSubscriptionCheck', now.toString());
            } catch (error) {
              console.error('Error fetching subscription data:', error);
              setSubscriptions([]);
            }
          } else {
            setSubscriptions([]);
            // Still update the timestamp to prevent repeated checks
            localStorage.setItem('lastSubscriptionCheck', now.toString());
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

  const value: PortfolioContextType = {
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
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
};