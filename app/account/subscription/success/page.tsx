"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { PaymentFeatureGuard } from '../../../components/PaymentFeatureGuard';

export default function SubscriptionSuccessPage() {
  const router = useRouter();

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