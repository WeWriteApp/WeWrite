"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../providers/AuthProvider';
import { useFeatureFlag } from '../../../utils/feature-flags';
import OpenCollectiveSupport from '../../../components/payments/OpenCollectiveSupport';

export default function SubscriptionSuccessPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isPaymentsEnabled = useFeatureFlag('payments', user?.email);

  // If payments feature flag is disabled, show OpenCollective support instead
  if (!isPaymentsEnabled) {
    return (
      <div className="max-w-md mx-auto p-4">
        <div className="mb-4">
          <Link href="/account" className="inline-flex items-center text-primary hover:text-primary/80 text-sm">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back to Account
          </Link>
        </div>
        <OpenCollectiveSupport
          title="Subscription Success Coming Soon!"
          description="We're working on subscription functionality. In the meantime, please support WeWrite development through OpenCollective."
        />
      </div>
    );
  }

  useEffect(() => {
    // Optional: Automatically redirect to account after a delay
    const timer = setTimeout(() => {
      router.push('/account?refresh=true');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <PaymentFeatureGuard redirectTo="/account">
      <div className="max-w-md mx-auto p-4 text-center">
      <div className="flex justify-center mb-6">
        <div className="bg-green-500/20 p-4 rounded-full">
          <CheckCircle className="h-12 w-12 text-green-400" />
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>

      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
        <p className="text-foreground mb-2">Your subscription has been activated successfully.</p>
        <p className="text-white/70 text-sm">You now have full access to all WeWrite features and content.</p>
      </div>

      <p className="text-sm text-white/50 mb-6">You will be automatically redirected to your account in a few seconds.</p>

      <div className="flex justify-center">
        <Link
          href="/account?refresh=true"
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Go to Your Account
        </Link>
      </div>
      </div>
    </PaymentFeatureGuard>
  );
}