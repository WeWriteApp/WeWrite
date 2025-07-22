"use client";

import React from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger} from "../ui/dialog";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import Link from "next/link";
import { SubscriptionTierBadge } from '../ui/SubscriptionTierBadge';

import { useAuth } from '../../providers/AuthProvider';
interface TierModalProps {
  children: React.ReactNode;
  trigger?: React.ReactNode;
  currentTier?: string | null;
  currentStatus?: string | null;
  userId?: string | null;
  username?: string | null;
}

export function SubscriptionInfoModal({ children, trigger, currentTier = null, currentStatus = null, userId = null, username = null }: TierModalProps) {
  const { user } = useAuth();
  // Payments feature is now always enabled
  const paymentsEnabled = true;

  const tiers = [
    {
      id: 'none',
      name: 'No Subscription',
      description: 'Not currently subscribed to WeWrite',
      amount: '$0/mo',
      status: null,
      tier: null
    },
    {
      id: 'tier1',
      name: 'Supporter',
      description: 'Subscribe to WeWrite for $10/month',
      amount: '$10/mo',
      status: 'active',
      tier: 'tier1'
    },
    {
      id: 'tier2',
      name: 'Enthusiast',
      description: 'Subscribe to WeWrite for $20/month',
      amount: '$20/mo',
      status: 'active',
      tier: 'tier2'
    },
    {
      id: 'tier3',
      name: 'Champion',
      description: 'Subscribe to WeWrite for $30+/month',
      amount: '$30+/mo',
      status: 'active',
      tier: 'tier3'
    },
    {
      id: 'custom',
      name: 'Custom',
      description: 'Subscribe to WeWrite for $30+/month',
      amount: '$30+/mo',
      status: 'active',
      tier: 'custom'
    }
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto rounded-lg border-theme-strong bg-card animate-in fade-in-0 zoom-in-95 duration-300 px-6 py-6">
        <DialogClose asChild>
          <Button variant="outline" size="icon" className="absolute right-4 top-4">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>
        <DialogHeader>
          <DialogTitle className="text-center w-full">
            {username ? `${username}'s subscription` : 'Your subscription'}
          </DialogTitle>
          <DialogDescription className="text-center">
            Right now, subscriptions go to support the development of WeWrite. In the future, readers will use their subscription to donate directly to writers!
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-4">
            {tiers.map((tier) => {
              // Use theme-aware background for all tiers
              const bgColorClass = 'bg-card';
              const borderColorClass = currentTier === tier.tier ? 'border-primary border-2' : 'border-theme-medium';
              return (
                <div
                  key={tier.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${bgColorClass} ${borderColorClass}`}
                >
                  <div className="flex-shrink-0">
                    <SubscriptionTierBadge tier={tier.tier} status={tier.status} size="lg" />
                  </div>
                  <div className="flex-grow">
                    <div className="font-medium">{tier.name}</div>
                    <div className="text-sm text-muted-foreground">{tier.description}</div>
                  </div>
                  <div className="text-right font-medium whitespace-nowrap">
                    {tier.amount}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 text-center">
            {userId && currentTier && currentStatus === 'active' ? (
              <div className="text-sm text-muted-foreground mb-3">
                This user has an active {currentTier === 'tier1' ? 'Tier 1' :
                                        currentTier === 'tier2' ? 'Tier 2' :
                                        currentTier === 'tier3' ? 'Tier 3' : 'Unknown'} subscription
              </div>
            ) : null}
            {/* Only show the CTA button if this is for the current user (no username and no userId) */}
            {(!username && !userId) && (
              <Link href="/settings/subscription">
                <Button>{currentTier && currentStatus === 'active' ? 'Manage Your Subscription' : 'Subscribe Now'}</Button>
              </Link>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}