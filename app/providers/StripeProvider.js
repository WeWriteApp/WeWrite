"use client";
import { createContext, useContext, useEffect, useState } from "react";
import useSWR from "swr"; // For auto-revalidation
import { useAuth } from "./AuthProvider";

const StripeContext = createContext();

export function StripeProvider({ children }) {
  const { user } = useAuth();
  const [customerId, setCustomerId] = useState(user?.stripeCustomerId || null);
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [upcomingInvoice, setUpcomingInvoice] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setCustomerId(user.stripeCustomerId);
  }, [user]);
  // 🔹 Fetch Function
  const fetcher = (url) => fetch(url).then((res) => res.json());

  // 🔹 Fetch Stripe Data (Invoices & Upcoming Payments)
  const { data: invoiceData } = useSWR(
    customerId ? `/api/payments/invoice?uid=${customerId}` : null,
    fetcher
  );

  const { data: paymentMethodsData } = useSWR(
    customerId ? `/api/payments/payment-methods?uid=${customerId}` : null,
    fetcher
  );

  const { data: subscriptionData } = useSWR(
    customerId ? `/api/payments/subscription?uid=${customerId}` : null,
    fetcher
  );

  useEffect(() => {
    if (invoiceData) {
      setInvoices(invoiceData.pastInvoices || []);
      setUpcomingInvoice(invoiceData.upcomingInvoice || null);
    }
    if (paymentMethodsData) {
      setPaymentMethods(paymentMethodsData || []);
    }
    if (subscriptionData) {
      setSubscription(subscriptionData || null);
    }
    setLoading(false);
  }, [invoiceData, paymentMethodsData, subscriptionData]);

  return (
    <StripeContext.Provider
      value={{
        subscription,
        invoices,
        upcomingInvoice,
        paymentMethods,
        loading,
        setSubscription,
      }}
    >
      {children}
    </StripeContext.Provider>
  );
}

// 🔹 Hook for accessing the Stripe context
export function useStripe() {
  return useContext(StripeContext);
}