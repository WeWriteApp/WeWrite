"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuth } from '../../providers/AuthProvider';
import Link from 'next/link';

const DISMISS_KEY = 'wewrite_subscription_cta_dismissed';
const DISMISS_COOLDOWN_DAYS = 7;

/**
 * SubscriptionCTACard
 *
 * Encouraging inline card shown on the home feed for authenticated users
 * who don't have an active subscription. Dismissable with a 7-day cooldown.
 */
export function SubscriptionCTACard() {
  const { user } = useAuth();
  const { hasActiveSubscription, isLoading } = useSubscription();
  const [dismissed, setDismissed] = useState(true); // default hidden until checked
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) {
      setDismissed(false);
      return;
    }
    const ts = parseInt(raw, 10);
    const daysSince = (Date.now() - ts) / (1000 * 60 * 60 * 24);
    setDismissed(daysSince < DISMISS_COOLDOWN_DAYS);
  }, []);

  const handleDismiss = () => {
    setIsDismissing(true);
    setTimeout(() => {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
      setDismissed(true);
      setIsDismissing(false);
    }, 250);
  };

  // Don't show if: loading, no user, already subscribed, or dismissed
  if (isLoading || !user || hasActiveSubscription || dismissed || isDismissing) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        className="mx-4 rounded-xl border border-primary/20 bg-primary/5 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 rounded-full bg-primary/10 p-2 shrink-0">
              <Icon name="Heart" size={18} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Support writers you love
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Start your subscription and begin donating to the writers who inspire you.
                Every contribution helps fund great writing.
              </p>
              <Link href="/settings/fund-account">
                <Button size="sm" variant="default" className="mt-2.5 h-7 text-xs px-3">
                  Get started
                </Button>
              </Link>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Dismiss"
          >
            <Icon name="X" size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
