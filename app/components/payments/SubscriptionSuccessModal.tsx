"use client";

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SubscriptionSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: string;
  amount: number;
}

export function SubscriptionSuccessModal({
  open,
  onOpenChange,
  tier,
  amount
}: SubscriptionSuccessModalProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  // Auto-dismiss countdown
  useEffect(() => {
    if (!open) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onOpenChange(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [open, onOpenChange]);

  // Reset countdown when modal opens
  useEffect(() => {
    if (open) {
      setCountdown(5);
    }
  }, [open]);

  const handleGoToAccount = () => {
    onOpenChange(false);
    router.push('/settings');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-16 w-16 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Subscription Activated!</DialogTitle>
          <DialogDescription className="text-center">
            Thank you for subscribing to WeWrite {tier}. Your subscription is now active.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 text-center">
          <p className="font-medium text-lg">
            ${amount}/month
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            You can manage your subscription at any time from your account settings.
          </p>
        </div>
        
        <div className="flex flex-col gap-2">
          <Button onClick={handleGoToAccount} className="w-full">
            Go to Account Settings <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            This dialog will close automatically in {countdown} seconds
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}