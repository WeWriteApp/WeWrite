"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { ArrowLeft, Check, Shield, DollarSign, Diamond, Award, Medal } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { createCheckoutSession } from '../services/stripeService';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';

const supporterTiers = [
  {
    id: 'bronze',
    name: 'Bronze Supporter',
    amount: 10,
    icon: <Medal className="h-6 w-6 text-amber-600" />,
    description: 'Support WeWrite development and get a Bronze supporter badge on your profile.',
    color: 'bg-amber-600',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-600/20',
    bgColor: 'bg-amber-600/10',
  },
  {
    id: 'silver',
    name: 'Silver Supporter',
    amount: 20,
    icon: <Award className="h-6 w-6 text-slate-400" />,
    description: 'Support WeWrite development and get a Silver supporter badge on your profile.',
    color: 'bg-slate-400',
    textColor: 'text-slate-400',
    borderColor: 'border-slate-400/20',
    bgColor: 'bg-slate-400/10',
  },
  {
    id: 'gold',
    name: 'Gold Supporter',
    amount: 50,
    icon: <Shield className="h-6 w-6 text-yellow-500" />,
    description: 'Support WeWrite development and get a Gold supporter badge on your profile.',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-500',
    borderColor: 'border-yellow-500/20',
    bgColor: 'bg-yellow-500/10',
  },
  {
    id: 'diamond',
    name: 'Diamond Supporter',
    amount: 'Custom',
    icon: <Diamond className="h-6 w-6 text-blue-400" />,
    description: 'Support WeWrite with a custom amount (minimum $51) and get a Diamond supporter badge.',
    color: 'bg-blue-400',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-400/20',
    bgColor: 'bg-blue-400/10',
    isCustom: true,
  }
];

export default function SupportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('50');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login?redirect=/support');
    }
  }, [user, router]);

  const handleTierSelect = (tierId: string) => {
    setSelectedTier(tierId);
    setError(null);
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmount(value);
  };

  const handleSubscribe = async () => {
    if (!user) {
      router.push('/auth/login?redirect=/support');
      return;
    }

    if (!selectedTier) {
      setError('Please select a supporter tier');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const selectedTierObj = supporterTiers.find(tier => tier.id === selectedTier);

      if (!selectedTierObj) {
        throw new Error('Invalid tier selected');
      }

      let amount = 0;

      if (selectedTierObj.isCustom) {
        amount = parseInt(customAmount, 10);
        if (isNaN(amount) || amount < 51) {
          setError('Custom amount must be at least $51');
          setLoading(false);
          return;
        }
      } else {
        amount = selectedTierObj.amount as number;
      }

      console.log('Creating checkout session with:', {
        userId: user.uid,
        amount,
        tierName: selectedTierObj.name
      });

      // Create a checkout session with Stripe
      // Don't use a fixed priceId, let the API create a dynamic price based on the amount
      const response = await createCheckoutSession({
        priceId: null, // Let the API create a dynamic price
        userId: user.uid,
        amount: amount,
        tierName: selectedTierObj.name
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // The user will be redirected to Stripe Checkout by the createCheckoutSession function
    } catch (err: any) {
      console.error('Error creating subscription:', err);

      // More detailed error message
      let errorMessage = 'Failed to create subscription';

      if (err.message) {
        if (err.message.includes('Unauthorized')) {
          errorMessage = 'Authentication error. Please try logging out and back in.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-blue-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Become an Early Supporter</h1>
        <p className="text-muted-foreground">
          Support WeWrite's development and get exclusive badges on your profile.
        </p>
      </div>

      <Alert className="mb-8 bg-primary/5 border-primary/20">
        <DollarSign className="h-5 w-5 text-primary" />
        <AlertTitle className="text-primary">About Writer Payouts</AlertTitle>
        <AlertDescription>
          Right now, you're just donating to the platform to help us with development costs.
          But once writer payouts is built, you'll be able to donate part of your monthly
          subscription directly to pages, which goes to the page's author.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {supporterTiers.map((tier) => (
          <Card
            key={tier.id}
            className={`cursor-pointer transition-all duration-200 ${
              selectedTier === tier.id
                ? `ring-2 ring-primary ${tier.bgColor}`
                : 'hover:border-primary/50 hover:bg-accent/50'
            }`}
            onClick={() => handleTierSelect(tier.id)}
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  {tier.icon}
                  <CardTitle>{tier.name}</CardTitle>
                </div>
                {selectedTier === tier.id && (
                  <div className="bg-primary text-primary-foreground rounded-full p-1">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </div>
              <CardDescription>
                {tier.description}
                <p className="mt-2 text-xs text-muted-foreground">
                  Once writer payouts are built, you'll be able to donate parts of your subscription to writers. For now, your subscription will go to support WeWrite's development costs!
                </p>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">
                  {tier.isCustom ? (
                    <Input
                      type="text"
                      value={customAmount}
                      onChange={handleCustomAmountChange}
                      className="w-24 text-lg font-bold"
                      onClick={(e) => e.stopPropagation()}
                      disabled={selectedTier !== tier.id}
                    />
                  ) : (
                    tier.amount
                  )}
                </span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleSubscribe}
          disabled={!selectedTier || loading}
          className="w-full md:w-auto"
        >
          {loading ? 'Processing...' : 'Subscribe Now'}
        </Button>
      </div>
    </div>
  );
}
