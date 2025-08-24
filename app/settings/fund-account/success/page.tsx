'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import NavPageLayout from '../../../components/layout/NavPageLayout';
import { Button } from '../../../components/ui/button';
import { CheckCircle, Home, CreditCard } from 'lucide-react';
import Confetti from 'react-confetti';

export default function FundAccountSuccessPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({ width: 0, height: 0 });

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

  // Redirect if no user and show confetti
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Show confetti immediately
    setShowConfetti(true);

    // Stop confetti after 5 seconds
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 5000);

    return () => clearTimeout(timer);
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
          {/* Success icon */}
          <div className="flex justify-center">
            <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full">
              <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
            </div>
          </div>

          {/* Success message */}
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-green-800 dark:text-green-400">
              Success!
            </h1>
            <p className="text-lg text-muted-foreground">
              Your account funding has been activated. You can now start supporting creators!
            </p>
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
