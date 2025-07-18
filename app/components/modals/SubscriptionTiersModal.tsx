"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { SubscriptionTierBadge } from '../ui/SubscriptionTierBadge';
import { Star, X } from 'lucide-react';
import { Button } from '../ui/button';

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
      description: "Free to read and explore",
      stars: 0,
      color: "text-muted-foreground"
    },
    {
      name: "Supporter",
      amount: 10,
      tier: "tier1",
      status: "active",
      description: "$10/month",
      stars: 1,
      color: "text-yellow-500"
    },
    {
      name: "Advocate",
      amount: 20,
      tier: "tier2",
      status: "active",
      description: "$20/month",
      stars: 2,
      color: "text-yellow-500"
    },
    {
      name: "Champion",
      amount: 30,
      tier: "tier3",
      status: "active",
      description: "$30+/month",
      stars: 3,
      color: "text-yellow-500"
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[90vw] max-h-[90vh]">
        <DialogHeader className="relative">
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

        <div className="space-y-4">
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
                  {/* Stars */}
                  <div className="flex-shrink-0 flex items-center gap-0.5">
                    {tier.stars === 0 ? (
                      <div className="h-4 w-4 rounded-full bg-muted" />
                    ) : (
                      Array.from({ length: tier.stars }).map((_, starIndex) => (
                        <Star
                          key={starIndex}
                          className={`h-3 w-3 ${tier.color} fill-current`}
                        />
                      ))
                    )}
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

          {/* Call to Action */}
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-xs text-foreground">
              <strong>Support writers</strong> by subscribing to help keep the community thriving.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
