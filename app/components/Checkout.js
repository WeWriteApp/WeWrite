"use client";
import { useState } from "react";
import { Elements, useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// Use the publishable key from stripe/index.js
const stripePromise = loadStripe('pk_test_51Q08VWIsJOA8IjJRnJg25SjW6aayav9j6lF2UMiMWP3o3wsFrwvULkuopDaIgujlFVJBdabvbHXjFG6TXPx6yoQu00DUGmhTyZ');

export default function Checkout({ clientSecret, onSuccess }) {
  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm onSuccess={onSuccess} />
    </Elements>
  );
}

const CheckoutForm = ({ onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/success`,
        },
      });

      if (error) {
        setError(`Payment failed: ${error.message}`);
        setProcessing(false);
      } else if (paymentIntent.status === 'succeeded') {
        // Store customer ID in localStorage
        if (paymentIntent.customer) {
          localStorage.setItem('stripe_customer_id', paymentIntent.customer);
        }
        if (onSuccess) {
          onSuccess(paymentIntent);
        }
        setProcessing(false);
      }
    } catch (err) {
      setError(`An unexpected error occurred: ${err.message}`);
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <PaymentElement className="mb-6" />
      {error && (
        <div className="text-red-500 mb-4" role="alert">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || processing}
        className={`w-full py-2 px-4 rounded ${
          processing
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600'
        } text-white font-semibold`}
      >
        {processing ? "Processing..." : "Subscribe"}
      </button>
    </form>
  );
};
