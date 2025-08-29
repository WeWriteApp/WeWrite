'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import NavPageLayout from '../../../components/layout/NavPageLayout';
import { Button } from '../../../components/ui/button';
import { CheckCircle, Home, CreditCard, Clock } from 'lucide-react';
import Confetti from 'react-confetti';

export default function FundAccountSuccessPage() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({ width: 0, height: 0 });
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  const subscriptionId = searchParams.get('subscription');

  // Get window dimensions for confetti
  useEffect(() => {
    const updateWindowDimensions = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateWindowDimensions();
    window.addEventListener('resize', updateWindowDimensions);

    return () => window.removeEventListener('resize', updateWindowDimensions);
  }, []);

  // Check subscription status
  useEffect(() => {
    if (!user || !subscriptionId) return;

    const checkSubscriptionStatus = async () => {
      try {
        setIsCheckingStatus(true);
        const response = await fetch('/api/subscription/status');
        if (response.ok) {
          const data = await response.json();
          const status = data.subscription?.status;
          setSubscriptionStatus(status);

          // Only show confetti if subscription is active
          if (status === 'active') {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
          }
        }
      } catch (error) {
        console.error('Error checking subscription status:', error);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkSubscriptionStatus();
  }, [user, subscriptionId]);

  // Redirect if no user
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <NavPageLayout>
      {showConfetti && (
        <Confetti
          width={windowDimensions.width}
          height={windowDimensions.height}
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
        />
      )}

      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="wewrite-card text-center space-y-8 max-w-md w-full">
          {/* Status icon */}
          <div className="flex justify-center">
            {isCheckingStatus ? (
              <div className="p-4 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                <Clock className="h-16 w-16 text-blue-600 dark:text-blue-400 animate-pulse" />
              </div>
            ) : subscriptionStatus === 'active' ? (
              <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full">
                <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <div className="p-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
                <Clock className="h-16 w-16 text-yellow-600 dark:text-yellow-400" />
              </div>
            )}
          </div>

          {/* Status message */}
          <div className="space-y-4">
            {isCheckingStatus ? (
              <>
                <h1 className="text-3xl font-bold text-blue-800 dark:text-blue-400">
                  Verifying...
                </h1>
                <p className="text-lg text-muted-foreground">
                  Just confirming your subscription details.
                </p>
              </>
            ) : subscriptionStatus === 'active' ? (
              <>
                <h1 className="text-3xl font-bold text-green-800 dark:text-green-400">
                  Success!
                </h1>
                <p className="text-lg text-muted-foreground">
                  Your account funding has been activated. You can now start supporting creators!
                </p>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-red-800 dark:text-red-400">
                  Payment Issue
                </h1>
                <p className="text-lg text-muted-foreground">
                  There was an issue processing your payment. Please try again or contact support.
                </p>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => router.push('/')}
              size="lg"
              className="w-full max-w-xs mx-auto"
            >
              <Home className="h-5 w-5 mr-2" />
              Go Home
            </Button>

            <Button
              onClick={() => router.push('/settings/fund-account')}
              variant="secondary"
              size="lg"
              className="w-full max-w-xs mx-auto"
            >
              <CreditCard className="h-5 w-5 mr-2" />
              View Subscription
            </Button>
          </div>
        </div>
      </div>
    </NavPageLayout>
  );
}
