"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
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
      name: 'Non-Supporter',
      description: 'Not currently supporting WeWrite',
      amount: '$0/mo',
      status: null,
      tier: null
    },
    {
      id: 'tier1',
      name: 'Tier 1 Supporter',
      description: 'Supporting WeWrite development',
      amount: '$10/mo',
      status: 'active',
      tier: 'tier1'
    },
    {
      id: 'tier2',
      name: 'Tier 2 Supporter',
      description: 'Supporting WeWrite development',
      amount: '$20/mo',
      status: 'active',
      tier: 'tier2'
    },
    {
      id: 'tier3',
      name: 'Tier 3 Supporter',
      description: 'Supporting WeWrite development',
      amount: '$50/mo',
      status: 'active',
      tier: 'tier3'
    },
    {
      id: 'tier4',
      name: 'Tier 4 Supporter',
      description: 'Supporting WeWrite development',
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
      <DialogContent className="sm:max-w-md m-4 max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Supporter Tiers</DialogTitle>
          <DialogDescription>
            Support WeWrite development and get a supporter badge on your profile.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-4">
            {tiers.map((tier) => (
              <div key={tier.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex-shrink-0">
                  <SupporterIcon tier={tier.tier} status={tier.status} size="lg" />
                </div>
                <div className="flex-grow">
                  <div className="font-medium">{tier.name}</div>
                  <div className="text-sm text-muted-foreground">{tier.description}</div>
                </div>
                <div className="text-right font-medium">
                  {tier.amount}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/support">
              <Button>Become a Supporter</Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
