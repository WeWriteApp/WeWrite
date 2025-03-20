'use client';

import { Elements, PaymentElement } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Basic checkout form component
function CheckoutForm() {
  return (
    <form className="max-w-md mx-auto">
      <PaymentElement />
      <button 
        type="submit"
        className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded"
      >
        Subscribe
      </button>
    </form>
  );
}

// Minimal page component
export default function SubscribePage() {
  const [clientSecret, setClientSecret] = useState<string>();

  useEffect(() => {
    // Create PaymentIntent as soon as the page loads
    fetch('/api/create-payment-intent', {
      method: 'POST',
    })
      .then((res) => res.json())
      .then((data) => setClientSecret(data.clientSecret));
  }, []);

  if (!clientSecret) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen p-6">
      <Elements 
        stripe={stripePromise} 
        options={{
          clientSecret,
          appearance: {
            theme: 'stripe',
          },
        }}
      >
        <CheckoutForm />
      </Elements>
    </div>
  );
} 