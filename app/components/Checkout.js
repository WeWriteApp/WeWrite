"use client";
import { useState } from "react";
import { Elements, useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// Your public test key from Stripe
const stripePromise = loadStripe('123');

export default function Checkout({ clientSecret }) {
  const options = {
    clientSecret: clientSecret, // Pass the client secret from the server
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm />
    </Elements>
  );
}

const CheckoutForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      return;
    }

    setProcessing(true);

    // Confirm the payment using PaymentElement
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href, // Optional: redirect URL after payment
      },
    });

    if (error) {
      setError(`Payment failed: ${error.message}`);
      setProcessing(false);
    } else {
      setSucceeded(true);
      setPaymentIntentId(paymentIntent.id);
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* PaymentElement will render all available payment methods */}
      <PaymentElement />
      {error && <div role="alert">{error}</div>}
      <button type="submit" disabled={!stripe || processing || succeeded}>
        {processing ? "Processing..." : "Pay Now"}
      </button>
      {succeeded && <p>Payment successful! Payment Intent ID: {paymentIntentId}</p>}
    </form>
  );
};
