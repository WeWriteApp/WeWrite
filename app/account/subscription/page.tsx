"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getUserSubscription } from '../../firebase/subscription';
import { Button } from '../../ui/button';
import { PaymentFeatureGuard } from '../../components/PaymentFeatureGuard';

// Define the Subscription interface
interface Subscription {
  id: string;
  amount: number;
  status: string;
  billingCycleEnd?: string;
  pledgedAmount?: number;
  stripeCustomerId?: string;
  stripePriceId?: string;
  stripeSubscriptionId?: string | null;
  createdAt?: any; // Firebase Timestamp
  updatedAt?: any; // Firebase Timestamp
}

const subscriptionOptions = [
  { value: 10, label: '$10/month' },
  { value: 20, label: '$20/month' },
  { value: 50, label: '$50/month' },
  { value: 100, label: '$100/month' },
];

export default function SubscriptionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedAmount, setSelectedAmount] = useState<number | string>(20);
  const [isCustomAmount, setIsCustomAmount] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    async function fetchSubscription() {
      try {
        const subscriptionData = await getUserSubscription(user.uid);

        if (subscriptionData) {
          const subscription = subscriptionData as Subscription;
          setCurrentSubscription(subscription);

          if ([10, 20, 50, 100].includes(subscription.amount)) {
            setSelectedAmount(subscription.amount);
          } else {
            setIsCustomAmount(true);
            setCustomAmount(subscription.amount.toString());
            setSelectedAmount('custom');
          }
        } else {
          setCurrentSubscription(null);
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSubscription();
  }, [user, router]);

  const handleAmountSelect = (amount: number | 'custom') => {
    if (amount === 'custom') {
      setIsCustomAmount(true);
      setSelectedAmount('custom');
    } else {
      setIsCustomAmount(false);
      setSelectedAmount(amount);
      setCustomAmount('');
    }
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Allow only numbers and decimal point
    if (/^\d*\.?\d{0,2}$/.test(value) || value === '') {
      setCustomAmount(value);
    }
  };

  const handleContinue = () => {
    const amount = isCustomAmount ? parseFloat(customAmount) : selectedAmount;

    if (isCustomAmount && (!customAmount || parseFloat(customAmount) < 5)) {
      alert('Please enter a valid amount (minimum $5)');
      return;
    }

    router.push(`/account/subscription/payment?amount=${amount}`);
  };

  return (
    <PaymentFeatureGuard redirectTo="/account">
      <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <Link href="/account" className="inline-flex items-center text-blue-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Account
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">WeWrite Subscription</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Choose your monthly subscription amount to support writers and access content.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {currentSubscription && (
            <div className="mb-8 p-4 bg-card rounded-lg border border-border">
              <h2 className="text-lg font-medium mb-2 text-card-foreground">Current Subscription</h2>
              <p className="text-card-foreground">
                You're currently subscribed at <strong>${currentSubscription.amount}/month</strong>.
                {currentSubscription.status === 'active' && (
                  <span className="text-green-500 ml-1 font-medium">Your subscription is active.</span>
                )}
                {currentSubscription.status === 'canceled' && (
                  <span className="text-orange-500 ml-1 font-medium">Your subscription has been canceled.</span>
                )}
                {currentSubscription.status === 'incomplete' && (
                  <span className="text-red-500 ml-1 font-medium">Your subscription is incomplete.</span>
                )}
              </p>
              {currentSubscription.billingCycleEnd && currentSubscription.status === 'active' && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Next billing date: {new Date(currentSubscription.billingCycleEnd).toLocaleDateString()}
                </p>
              )}
              {currentSubscription.status !== 'active' && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Please select a subscription amount below to continue.
                </p>
              )}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-medium mb-4">Select a subscription amount</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {subscriptionOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleAmountSelect(option.value)}
                    className={`flex flex-col items-center justify-center w-full p-6 rounded-lg border-2 transition-all duration-200 min-h-[140px] ${
                      selectedAmount === option.value
                        ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                        : 'border-border bg-card hover:border-primary/50 hover:bg-accent/50'
                    }`}
                  >
                    <span className="text-3xl mb-2">{'★'.repeat(option.value === 10 ? 1 : option.value === 20 ? 2 : 3)}</span>
                    <span className="text-lg font-semibold mb-1">Tier {subscriptionOptions.indexOf(option) + 1}</span>
                    <span className="text-base">{option.label}</span>
                  </button>
                ))}
                {/* Custom amount card */}
                <div
                  className={`flex flex-col items-center justify-center w-full p-6 rounded-lg border-2 transition-all duration-200 min-h-[140px] ${
                    selectedAmount === 'custom'
                      ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                      : 'border-border bg-card hover:border-primary/50 hover:bg-accent/50'
                  }`}
                  onClick={() => handleAmountSelect('custom')}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="text-3xl mb-2">★ ★ ★</span>
                  <span className="text-lg font-semibold mb-1">Custom</span>
                  {selectedAmount === 'custom' ? (
                    <div className="w-full flex flex-col items-center mt-2">
                      <label htmlFor="custom-amount" className="block text-sm font-medium mb-1">
                        Enter custom amount (min $5)
                      </label>
                      <div className="relative w-full flex items-center justify-center">
                        <span className="absolute left-3 text-muted-foreground">$</span>
                        <input
                          id="custom-amount"
                          type="text"
                          value={customAmount}
                          onChange={handleCustomAmountChange}
                          placeholder="Amount"
                          className="pl-7 pr-12 py-2 w-full rounded-md border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary text-center text-lg font-semibold"
                          autoFocus
                        />
                        <span className="absolute right-3 text-muted-foreground">/month</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-base">Custom</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <Button
                onClick={handleContinue}
                disabled={!selectedAmount || (isCustomAmount && (!customAmount || parseFloat(customAmount) < 5))}
                className={`w-full transition-all duration-200 ${
                  (!selectedAmount || (isCustomAmount && (!customAmount || parseFloat(customAmount) < 5)))
                    ? 'opacity-50 cursor-not-allowed'
                    : 'opacity-100 hover:translate-y-[-1px]'
                }`}
              >
                Continue to Payment
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
      </div>
    </PaymentFeatureGuard>
  );
}