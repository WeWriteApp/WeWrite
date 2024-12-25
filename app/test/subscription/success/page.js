'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SubscriptionSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Wait for 3 seconds then redirect to pages
    const timer = setTimeout(() => {
      router.push('/pages');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Payment Successful!</h1>
      <p className="mb-4">
        Your subscription has been created successfully. You will be redirected to your pages in a few seconds...
      </p>
    </div>
  );
}
