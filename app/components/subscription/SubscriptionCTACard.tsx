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
 * Inline card shown in the activity feed for authenticated users
 * who don't have an active subscription. Dismissable with a 7-day cooldown.
 * Uses the design system wewrite-card style.
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
        initial={{ opacity: 0, scale: 0.97, height: 0 }}
        animate={{ opacity: 1, scale: 1, height: 'auto' }}
        exit={{ opacity: 0, scale: 0.95, height: 0 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="overflow-hidden"
      >
        <div className="wewrite-card w-full overflow-hidden flex flex-col p-3 md:p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <Icon name="Heart" size={14} className="text-primary-foreground" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                Support writers you love
              </span>
            </div>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Dismiss"
            >
              <Icon name="X" size={16} />
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-3">
            Start a subscription and fund the writers who inspire you.
            Every contribution helps support great writing.
          </p>

          <div className="flex items-center gap-2">
            <Link href="/settings/fund-account">
              <Button size="sm" className="gap-1">
                Get started
                <Icon name="ArrowRight" size={14} />
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
