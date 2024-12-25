'use client';

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useState, useEffect } from 'react';

const appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#0066cc',
    colorBackground: '#ffffff',
    colorText: '#30313d',
    colorDanger: '#df1b41',
    fontFamily: 'system-ui, sans-serif',
    spacingUnit: '4px',
    borderRadius: '4px',
  },
};

export function StripeProvider({ children, options = {} }) {
  const [stripePromise, setStripePromise] = useState(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    console.log('Initializing Stripe with key:', key ? 'present' : 'missing');

    if (key) {
      setStripePromise(loadStripe(key));
    }
  }, []);

  const defaultOptions = {
    appearance,
    loader: 'auto',
  };

  const combinedOptions = {
    ...defaultOptions,
    ...options,
  };

  console.log('StripeProvider options:', combinedOptions);

  if (!stripePromise) {
    return <div>Loading Stripe...</div>;
  }

  return (
    <Elements stripe={stripePromise} options={combinedOptions}>
      {children}
    </Elements>
  );
}
