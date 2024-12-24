"use client";
import { useState, useContext, useEffect } from 'react';
import { PortfolioContext } from '@/providers/PortfolioProvider';
import Checkout from '@/components/Checkout';
import PledgeBar from '@/components/PledgeBar';
import DonateBar from '@/components/DonateBar';

export default function TestSubscriptionPage() {
  const [showCheckout, setShowCheckout] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const { addSubscription } = useContext(PortfolioContext);

  // Create customer if doesn't exist
  useEffect(() => {
    const createCustomer = async () => {
      const existingCustomerId = localStorage.getItem('stripe_customer_id');
      if (!existingCustomerId) {
        try {
          const response = await fetch('/api/payments/create-customer', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          const data = await response.json();
          if (data.customerId) {
            localStorage.setItem('stripe_customer_id', data.customerId);
          }
        } catch (error) {
          console.error('Error creating customer:', error);
        }
      }
    };
    createCustomer();
  }, []);

  const handleSubscribe = async () => {
    try {
      const customerId = localStorage.getItem('stripe_customer_id');
      if (!customerId) {
        console.error('No customer ID found');
        return;
      }

      const response = await fetch('/api/payments/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
          amount: 1000, // $10 in cents
        }),
      });

      const data = await response.json();
      if (data.error) {
        console.error('Error:', data.error);
        return;
      }

      setClientSecret(data.clientSecret);
      setShowCheckout(true);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handlePaymentSuccess = (paymentIntent) => {
    // Add subscription to context
    addSubscription(10, 'test-page-id'); // $10/month default
    setShowCheckout(false);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Test Subscription Page</h1>

      <div className="mb-8">
        <h2 className="text-xl mb-4">Current Subscription</h2>
        <PledgeBar />
      </div>

      <div className="mb-8">
        <h2 className="text-xl mb-4">Donate</h2>
        <DonateBar />
      </div>

      {!showCheckout ? (
        <button
          onClick={handleSubscribe}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Subscribe ($10/month)
        </button>
      ) : (
        clientSecret && (
          <div className="max-w-md mx-auto">
            <Checkout
              clientSecret={clientSecret}
              onSuccess={handlePaymentSuccess}
            />
          </div>
        )
      )}

      <div className="mt-8">
        <h3 className="font-semibold mb-2">Test Cards:</h3>
        <ul className="list-disc pl-4">
          <li>Success: 4242 4242 4242 4242</li>
          <li>Failure: 4000 0000 0000 9995</li>
          <li>Other fields: Any future date, any 3 digits for CVC</li>
        </ul>
      </div>
    </div>
  );
}
