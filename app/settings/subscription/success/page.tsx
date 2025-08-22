'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle } from 'lucide-react';

export default function SubscriptionSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to settings after 3 seconds
    const timer = setTimeout(() => {
      router.push('/settings/fund-account');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="wewrite-card p-8 max-w-md w-full mx-4 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Subscription Successful!</h1>
        <p className="text-muted-foreground mb-4">
          Your subscription has been activated successfully. You can now start funding your account.
        </p>
        <p className="text-sm text-muted-foreground">
          Redirecting to fund account page in 3 seconds...
        </p>
      </div>
    </div>
  );
}