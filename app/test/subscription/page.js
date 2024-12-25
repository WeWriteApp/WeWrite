'use client';

import { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { PortfolioProvider } from '../../providers/PortfolioProvider';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

const CustomerCreation = ({ onCustomerCreated }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCustomerId = async () => {
      try {
        const response = await fetch('/api/payments/create-customer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'test@example.com',
            uid: 'mock-user-1',
            name: 'Test User',
          }),
        });

        if (!response.ok) throw new Error('Failed to create customer');
        const data = await response.json();
        localStorage.setItem('stripe_customer_id', data.customerId);
        onCustomerCreated(data.customerId);
      } catch (err) {
        console.error('Error creating customer:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerId();
  }, [onCustomerCreated]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return null;
};

const PaymentForm = ({ clientSecret }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/test/subscription/success`,
      },
    });

    if (submitError) {
      setError(submitError.message);
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <div className="text-red-600">{error}</div>}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-blue-500 text-white py-2 px-4 rounded disabled:bg-gray-300"
      >
        {processing ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
};

const TestSubscriptionPage = () => {
  const [customerId, setCustomerId] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [error, setError] = useState(null);
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    const createCustomer = async () => {
      try {
        const response = await fetch('/api/payments/create-customer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'test@example.com',
            uid: 'mock-user-1',
            name: 'Test User',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create customer');
        }

        const data = await response.json();
        setCustomerId(data.customerId);
      } catch (error) {
        console.error('Error creating customer:', error);
        setError(error.message);
      }
    };

    if (!customerId) {
      createCustomer();
    }
  }, [customerId]);

  const handleIncrement = () => {
    if (amount < 10) {
      setAmount(amount + 1);
    }
  };

  const handleDecrement = () => {
    if (amount > 0) {
      setAmount(amount - 1);
    }
  };

  const handleSubscribe = async () => {
    try {
      const response = await fetch('/api/subscriptions/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': customerId,
        },
        body: JSON.stringify({
          pageId: 'test-page-1',
          amount: amount,
          percentage: (amount / 10) * 100,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Subscription update failed:', errorData);
        throw new Error(errorData.error || 'Failed to update subscription');
      }

      const data = await response.json();
      console.log('Subscription update response:', data);

      if (data.subscription?.clientSecret) {
        setClientSecret(data.subscription.clientSecret);
      } else {
        console.error('No client secret received:', data);
        throw new Error('No client secret received');
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
      setError(error.message);
    }
  };

  const handleTryAgain = () => {
    setError(null);
    setClientSecret(null);
  };

  return (
    <PortfolioProvider>
      <CustomerCreation onCustomerCreated={setCustomerId} />
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-8">Test Subscription Page</h1>

        <div className="w-full max-w-md space-y-6">
          {customerId && (
            <>
              <div className="p-4 bg-white rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Customer ID: {customerId}</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Use this test page to verify subscription creation and percentage allocation.
                </p>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Pledge</h3>
                  <div className="flex items-center gap-4 mb-4">
                    <button
                      onClick={handleDecrement}
                      className="bg-gray-200 px-3 py-1 rounded"
                      aria-label="Decrease allocation"
                    >
                      -
                    </button>
                    <button
                      onClick={handleIncrement}
                      className="bg-gray-200 px-3 py-1 rounded"
                      aria-label="Increase allocation"
                    >
                      +
                    </button>
                    <span className="text-lg">
                      ${amount.toFixed(2)}/ $10
                    </span>
                  </div>
                  <button
                    onClick={handleSubscribe}
                    disabled={amount === 0}
                    className={`px-4 py-2 rounded ${
                      amount === 0
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    Subscribe
                  </button>
                </div>
              </div>

              {clientSecret && (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <PaymentForm clientSecret={clientSecret} />
                </Elements>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <h2 className="text-lg font-semibold text-red-700 mb-2">Error</h2>
                  <p className="text-red-600 mb-2">{error}</p>
                  <button
                    onClick={handleTryAgain}
                    className="bg-red-100 text-red-700 px-4 py-2 rounded hover:bg-red-200"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PortfolioProvider>
  );
};

export default TestSubscriptionPage;
