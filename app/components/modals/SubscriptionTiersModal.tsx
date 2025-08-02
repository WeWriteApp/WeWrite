"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { SubscriptionTierBadge } from '../ui/SubscriptionTierBadge';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import Link from 'next/link';

interface SubscriptionTiersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubscriptionTiersModal({ isOpen, onClose }: SubscriptionTiersModalProps) {
  const tiers = [
    {
      name: "No Subscription",
      amount: 0,
      tier: "inactive",
      status: "inactive",
      description: "Free to read and explore"
    },
    {
      name: "Supporter",
      amount: 5,
      tier: "tier1",
      status: "active",
      description: "$5/month"
    },
    {
      name: "Advocate",
      amount: 20,
      tier: "tier2",
      status: "active",
      description: "$20/month"
    },
    {
      name: "Champion",
      amount: 50,
      tier: "tier3",
      status: "active",
      description: "$50/month"
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[90vw] max-h-[90vh] flex flex-col">
        <DialogHeader className="relative flex-shrink-0">
          <DialogTitle className="text-lg font-semibold pr-8">Subscription Tiers</DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-6 w-6 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Explanation */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              WeWrite shows subscription levels as badges of honor. Readers' generosity helps keep writers writing.
            </p>
          </div>

          {/* Tiers List */}
          <div className="space-y-2">
            {tiers.map((tier, index) => {
              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 border border-border rounded-lg"
                >
                  {/* Use SubscriptionTierBadge for consistent star display */}
                  <div className="flex-shrink-0">
                    <SubscriptionTierBadge
                      tier={tier.tier}
                      status={tier.status}
                      amount={tier.amount}
                      size="md"
                    />
                  </div>

                  {/* Tier Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-foreground text-sm">{tier.name}</h3>
                      <span className="text-xs text-muted-foreground">{tier.description}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>


        </div>

        {/* Set up mine button at bottom */}
        <div className="flex-shrink-0 pt-4 border-t border-border">
          <Link href="/settings/subscription" onClick={onClose}>
            <Button variant="default" className="w-full">
              Set up mine
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
