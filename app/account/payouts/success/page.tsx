"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import { CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../../../ui/button';
import { getConnectAccountStatus } from '../../../services/stripeConnectService';

export default function PayoutSetupSuccessPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accountStatus, setAccountStatus] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // Check the account status
    const checkStatus = async () => {
      try {
        const status = await getConnectAccountStatus(user.uid);
        setAccountStatus(status);
      } catch (error) {
        console.error('Error checking account status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();

    // Redirect to payouts page after 5 seconds
    const redirectTimer = setTimeout(() => {
      router.push('/account/payouts');
    }, 5000);

    return () => clearTimeout(redirectTimer);
  }, [user, router]);

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="mb-4">
        <Link href="/account/payouts" className="inline-flex items-center text-blue-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Payouts
        </Link>
      </div>
      
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        
        <h1 className="text-2xl font-bold mb-2 text-green-800 dark:text-green-300">Payout Setup Complete!</h1>
        
        {loading ? (
          <div className="animate-pulse h-4 bg-green-200 dark:bg-green-800 rounded w-3/4 mx-auto my-4"></div>
        ) : accountStatus && accountStatus.accountStatus === 'complete' ? (
          <div className="mb-6">
            <p className="text-green-700 dark:text-green-400 mb-2">
              Your Stripe Connect account has been successfully set up.
            </p>
            <p className="text-green-600 dark:text-green-500 text-sm">
              You're now ready to receive payouts from donations to your pages.
            </p>
          </div>
        ) : (
          <div className="mb-6">
            <p className="text-green-700 dark:text-green-400 mb-2">
              Your Stripe Connect account setup is in progress.
            </p>
            <p className="text-green-600 dark:text-green-500 text-sm">
              You may need to complete additional steps to start receiving payouts.
            </p>
          </div>
        )}
        
        <p className="text-sm text-green-600 dark:text-green-500 mb-6">
          You'll be redirected to the payouts page in a few seconds...
        </p>
        
        <div className="flex flex-col space-y-3">
          <Button
            onClick={() => router.push('/account/payouts')}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Go to Payouts
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          
          <Button
            onClick={() => router.push('/account')}
            variant="outline"
            className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/30"
          >
            Back to Account
          </Button>
        </div>
      </div>
    </div>
  );
}
