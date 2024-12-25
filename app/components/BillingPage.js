"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import AccountWidget from "./AccountWidget";
import ChargesTable from "./ChargesTable";
import FundingSources from "./FundingSources";
import FundingTransactionsTable from "./FundingTransactionsTable";
import SubscriptionsTable from "./SubscriptionsTable";
import Link from "next/link";
import Tabs from "./Tabs";
import Checkout from "./Checkout";

export default function BillingPage() {
  const [clientSecret, setClientSecret] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    console.log('BillingPage state:', {
      clientSecret,
      showCheckout,
      loading,
      error,
      hasUser: !!user,
      hasStripeCustomerId: !!user?.stripeCustomerId
    });
  }, [clientSecret, showCheckout, loading, error, user]);

  const handleSubscribe = async () => {
    if (!user?.uid || !user?.email) {
      setError("Please log in to subscribe.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Creating subscription for user:', user.uid);

      // First ensure we have a customer
      const customerResponse = await fetch('/api/payments/create-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          name: user.displayName || user.email,
          userId: user.uid,
        }),
      });

      if (!customerResponse.ok) {
        const errorData = await customerResponse.json();
        throw new Error(errorData.error || 'Failed to initialize customer');
      }

      const customerData = await customerResponse.json();
      console.log('Customer data:', customerData);

      // Create subscription
      const response = await fetch('/api/payments/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customerData.customerId,
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
        }),
      });

      console.log('Subscription creation response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Subscription creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create subscription');
      }

      const data = await response.json();
      console.log('Subscription created successfully:', data);

      if (!data.clientSecret) {
        throw new Error('No client secret received from subscription creation');
      }

      console.log('Setting clientSecret:', data.clientSecret);
      setClientSecret(data.clientSecret);
      setShowCheckout(true);
    } catch (error) {
      console.error('Error creating subscription:', error);
      setError(error.message || 'Failed to create subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowCheckout(false);
    window.location.reload();
  };

  const [tabs] = useState([
    {
      label: "Subscriptions",
      content: (
        <div className="space-y-4">
          <SubscriptionsTable />
          <div className="mt-4">
            {!showCheckout && (
              <button
                onClick={handleSubscribe}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                disabled={loading || !user?.stripeCustomerId}
              >
                {loading ? 'Processing...' : 'Subscribe Now'}
              </button>
            )}
          </div>
        </div>
      ),
    },
    {
      label: "Charges",
      content: <ChargesTable />,
    },
    {
      label: "Funding Sources",
      content: <FundingSources />,
    },
    {
      label: "Funding Transactions",
      content: <FundingTransactionsTable />,
    },
  ]);

  return (
    <>
      <Breadcrumb />
      <h1 className="text-3xl font-semibold mt-4 md:mt-10">Billing & Subscription</h1>
      <AccountWidget />

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {showCheckout && clientSecret ? (
        <div className="mt-4 p-4 border rounded-lg">
          <Checkout clientSecret={clientSecret} onSuccess={handlePaymentSuccess} />
        </div>
      ) : (
        <Tabs>
          {tabs.map((tab, index) => (
            <div key={index} label={tab.label}>
              {tab.content}
            </div>
          ))}
        </Tabs>
      )}
    </>
  );
}

const Breadcrumb = () => (
  <div className="flex items-center">
    <Link href="/settings" className="text-gray-500">
      Settings
    </Link>
    <span className="mx-2">/</span>
    <span className="font-semibold">Billing</span>
  </div>
);
