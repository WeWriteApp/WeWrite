"use client";

import React from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import { SupporterIcon } from './SupporterIcon';

interface TierModalProps {
  children: React.ReactNode;
  trigger?: React.ReactNode;
}

export function TierModal({ children, trigger }: TierModalProps) {
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
      name: 'Tier 1 Subscription',
      description: 'Subscribe to WeWrite for $10/month',
      amount: '$10/mo',
      status: 'active',
      tier: 'tier1'
    },
    {
      id: 'tier2',
      name: 'Tier 2 Subscription',
      description: 'Subscribe to WeWrite for $20/month',
      amount: '$20/mo',
      status: 'active',
      tier: 'tier2'
    },
    {
      id: 'tier3',
      name: 'Tier 3 Subscription',
      description: 'Subscribe to WeWrite for $50/month',
      amount: '$50/mo',
      status: 'active',
      tier: 'tier3'
    },
    {
      id: 'tier4',
      name: 'Tier 4 Subscription',
      description: 'Subscribe to WeWrite for $100+/month',
      amount: '$100+/mo',
      status: 'active',
      tier: 'tier4'
    }
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto rounded-lg animate-in fade-in-0 zoom-in-95 duration-300 mx-4 my-8 w-[calc(100%-2rem)]">
        <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
        <DialogHeader>
          <DialogTitle>Subscription Tiers</DialogTitle>
          <DialogDescription>
            Right now, subscriptions help to pay for the cost of developing WeWrite. In the future, you'll be able to donate parts of your subscription directly to writers, to support their writing practice.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-4">
            {tiers.map((tier) => {
              // Use white background for all tiers
              const bgColorClass = 'bg-white dark:bg-gray-800';

              return (
                <div key={tier.id} className={`flex items-center gap-3 p-3 rounded-lg border ${bgColorClass}`}>
                  <div className="flex-shrink-0">
                    <SupporterIcon tier={tier.tier} status={tier.status} size="lg" />
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
            <Link href="/support">
              <Button>Subscribe Now</Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
