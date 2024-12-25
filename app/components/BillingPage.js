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

  const handleSubscribe = async () => {
    if (!user?.stripeCustomerId) {
      setError("User not properly initialized. Please try again later.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: user.stripeCustomerId,
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create subscription');
      }

      const data = await response.json();
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
        <div>
          <SubscriptionsTable />
          {!showCheckout ? (
            <button
              onClick={handleSubscribe}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
              disabled={loading || !user?.stripeCustomerId}
            >
              {loading ? 'Processing...' : 'Subscribe Now'}
            </button>
          ) : (
            <div className="mt-4">
              <Checkout clientSecret={clientSecret} onSuccess={handlePaymentSuccess} />
            </div>
          )}
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

      <Tabs>
        {tabs.map((tab, index) => (
          <div key={index} label={tab.label}>
            {tab.content}
          </div>
        ))}
      </Tabs>
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
