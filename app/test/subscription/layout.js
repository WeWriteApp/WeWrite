'use client';

import { StripeProvider } from '../../providers/StripeProvider';

export default function TestSubscriptionLayout({ children }) {
  return (
    <StripeProvider>
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    </StripeProvider>
  );
}
