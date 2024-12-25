"use client";
import { useState, useEffect } from "react";
import { Elements, useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// Initialize Stripe only once with the correct publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

function CheckoutForm({ onSuccess, clientSecret }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [elementMounted, setElementMounted] = useState(false);

  // Reset state when client secret changes
  useEffect(() => {
    setElementMounted(false);
    setError(null);
  }, [clientSecret]);

  useEffect(() => {
    let mounted = true;

    const checkElements = async () => {
      if (stripe && elements && mounted) {
        try {
          const element = elements.getElement(PaymentElement);
          if (element) {
            console.log('PaymentElement mounted successfully');
            setElementMounted(true);
          } else {
            console.error('PaymentElement not found in elements');
            setError('Payment form failed to initialize');
          }
        } catch (err) {
          console.error('Error checking PaymentElement:', err);
          if (mounted) {
            setError(`Payment form error: ${err.message}`);
          }
        }
      }
    };

    checkElements();

    return () => {
      mounted = false;
    };
  }, [stripe, elements]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements || !elementMounted) {
      console.log('Form not ready:', { hasStripe: !!stripe, hasElements: !!elements, elementMounted });
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      console.log('Confirming payment with client secret:', clientSecret);
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/profile/billing`,
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        console.error('Payment confirmation error:', confirmError);
        setError(`Payment failed: ${confirmError.message}`);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        console.log('Payment succeeded:', paymentIntent);
        if (onSuccess) {
          onSuccess(paymentIntent);
        }
      }
    } catch (err) {
      console.error('Payment processing error:', err);
      setError(`An unexpected error occurred: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-md">
        {!elementMounted && (
          <div className="text-gray-500 text-center py-4">
            {error || 'Initializing payment form...'}
          </div>
        )}
        <PaymentElement
          className="mb-6"
          options={{
            layout: 'tabs',
            fields: {
              billingDetails: 'never'
            }
          }}
          onLoadError={(err) => {
            console.error('PaymentElement load error:', err);
            setError(`Payment form error: ${err.message}`);
          }}
        />
      </div>
      {error && (
        <div className="text-red-500 p-4 bg-red-50 rounded-md" role="alert">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!elementMounted || processing}
        className={`w-full py-3 px-4 rounded-md ${
          !elementMounted || processing
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600'
        } text-white font-semibold transition-colors`}
      >
        {processing ? "Processing..." : "Subscribe"}
      </button>
    </form>
  );
}

export default function Checkout({ clientSecret, onSuccess }) {
  const [stripeError, setStripeError] = useState(null);

  useEffect(() => {
    if (!clientSecret) {
      setStripeError('No client secret provided');
      return;
    }
    console.log('Client secret received:', clientSecret);
  }, [clientSecret]);

  if (stripeError) {
    return <div className="text-red-500 p-4">{stripeError}</div>;
  }

  if (!clientSecret) {
    return <div className="p-4">Preparing payment form...</div>;
  }

  console.log('Initializing Checkout with client secret:', clientSecret);

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#0066cc',
      },
    },
    loader: 'auto'
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <Elements stripe={stripePromise} options={options} key={clientSecret}>
        <CheckoutForm onSuccess={onSuccess} clientSecret={clientSecret} />
      </Elements>
    </div>
  );
}
