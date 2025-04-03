"use client";
import { useState, useEffect } from "react";
import { Elements, useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// Make sure to use the publishable key here, not the secret key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

const subscriptionOptions = [
  { value: 10, label: '$10' },
  { value: 20, label: '$20' },
  { value: 50, label: '$50' },
  { value: 100, label: '$100' },
  { value: 'custom', label: 'Custom' }
];

export default function Checkout({ userId, amount = 10, onSuccess }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAmount, setSelectedAmount] = useState(amount);
  const [customAmount, setCustomAmount] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  useEffect(() => {
    // Create PaymentIntent as soon as the component loads
    const createPaymentIntent = async () => {
      try {
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            amount: showCustomInput ? Number(customAmount) : selectedAmount,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create payment intent');
        }

        setClientSecret(data.clientSecret);
      } catch (err) {
        setError(err.message);
        console.error('Error creating payment intent:', err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      createPaymentIntent();
    }
  }, [userId, selectedAmount, customAmount, showCustomInput]);

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto p-6 animate-pulse">
        <div className="h-12 bg-gray-200 rounded-md mb-4"></div>
        <div className="h-40 bg-gray-200 rounded-md"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-md mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-600">
          {error}
        </div>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#0570de',
        colorBackground: '#ffffff',
        colorText: '#30313d',
        colorDanger: '#df1b41',
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '4px',
      },
    },
    payment_method_types: ['card', 'apple_pay'],
    apple_pay: {
      merchantId: process.env.NEXT_PUBLIC_APPLE_MERCHANT_ID,
      merchantName: 'WeWrite',
      buttonType: 'buy',
      buttonStyle: 'black',
    },
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {subscriptionOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                if (option.value === 'custom') {
                  setShowCustomInput(true);
                } else {
                  setShowCustomInput(false);
                  setSelectedAmount(option.value);
                }
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                (showCustomInput && option.value === 'custom') || (!showCustomInput && selectedAmount === option.value)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {showCustomInput && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-foreground/70">$</span>
            <input
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              min="1"
              step="1"
              className="w-32 px-3 py-1 border-theme-medium rounded-md bg-background text-foreground"
              placeholder="Enter amount"
            />
            <button
              onClick={() => setShowCustomInput(false)}
              className="text-sm text-foreground/70 hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {clientSecret && (
        <Elements stripe={stripePromise} options={options}>
          <div className="border-theme-medium rounded-lg overflow-hidden shadow-sm">
            <CheckoutForm onSuccess={onSuccess} />
          </div>
        </Elements>
      )}
    </div>
  );
}

const CheckoutForm = ({ onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (error) {
      setError(`Payment failed: ${error.message}`);
      setProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      setSucceeded(true);
      setProcessing(false);
      if (onSuccess) {
        onSuccess(paymentIntent);
      }
    } else {
      setError('An unexpected error occurred.');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <PaymentElement />
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-600">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || processing || succeeded}
        className="w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {processing ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </span>
        ) : (
          'Pay Now'
        )}
      </button>
      {succeeded && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-600">
          Payment successful!
        </div>
      )}
    </form>
  );
};
