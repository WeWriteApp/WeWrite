'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SubscriptionRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new fund-account page
    router.replace('/settings/fund-account');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-lg font-medium mb-2">Redirecting...</h1>
        <p className="text-muted-foreground">Taking you to the account funding page</p>
      </div>
    </div>
  );
}