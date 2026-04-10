'use client';

/**
 * Dev-only admin panel for simulating subscription states.
 * Only renders in development mode. Allows testing different
 * subscription tiers, statuses, and edge cases without real Stripe subscriptions.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Icon } from '../ui/Icon';

export interface DevSubscriptionOverride {
  enabled: boolean;
  status: string;
  amount: number;
  cancelAtPeriodEnd: boolean;
}

const STORAGE_KEY = 'wewrite_dev_subscription_override';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'past_due', label: 'Past Due' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'paused', label: 'Paused' },
];

const TIER_PRESETS = [
  { label: 'No Subscription', amount: 0, status: 'inactive' },
  { label: 'Supporter ($10)', amount: 10, status: 'active' },
  { label: 'Advocate ($20)', amount: 20, status: 'active' },
  { label: 'Champion ($30)', amount: 30, status: 'active' },
  { label: 'Custom ($50)', amount: 50, status: 'active' },
];

function getStoredOverride(): DevSubscriptionOverride {
  if (typeof window === 'undefined') {
    return { enabled: false, status: 'inactive', amount: 0, cancelAtPeriodEnd: false };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { enabled: false, status: 'inactive', amount: 0, cancelAtPeriodEnd: false };
}

function saveOverride(override: DevSubscriptionOverride) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(override));
  // Also sync the legacy key for backward compat
  if (override.enabled && override.status === 'inactive' && override.amount === 0) {
    localStorage.setItem('wewrite_admin_no_subscription_mode', 'true');
  } else {
    localStorage.removeItem('wewrite_admin_no_subscription_mode');
  }
  window.dispatchEvent(new Event('devSubscriptionOverrideChange'));
}

export function getDevSubscriptionOverride(): DevSubscriptionOverride | null {
  if (typeof window === 'undefined') return null;
  if (process.env.NODE_ENV !== 'development') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const override = JSON.parse(stored);
      if (override.enabled) return override;
    }
  } catch {}
  return null;
}

export default function DevSubscriptionPanel() {
  const { user } = useAuth();
  const [override, setOverride] = useState<DevSubscriptionOverride>(getStoredOverride);
  const [collapsed, setCollapsed] = useState(true);

  // Don't render in production or for non-admins
  if (process.env.NODE_ENV !== 'development') return null;
  if (!user?.isAdmin) return null;

  const update = (patch: Partial<DevSubscriptionOverride>) => {
    const next = { ...override, ...patch };
    setOverride(next);
    saveOverride(next);
  };

  const applyPreset = (preset: typeof TIER_PRESETS[number]) => {
    update({ status: preset.status, amount: preset.amount });
  };

  return (
    <div className="border border-dashed border-amber-500/60 bg-amber-500/5 rounded-lg overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Icon name="FlaskConical" size={14} />
          Dev: Subscription Testing
          {override.enabled && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 font-normal">
              {override.status} · ${override.amount}
              {override.cancelAtPeriodEnd ? ' · cancelling' : ''}
            </span>
          )}
        </span>
        <Icon name={collapsed ? 'ChevronDown' : 'ChevronUp'} size={14} />
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-4 border-t border-amber-500/20">
          {/* Enable toggle */}
          <label className="flex items-center gap-3 pt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={override.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
              className="rounded border-amber-500/50 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm font-medium text-foreground">
              Override subscription state
            </span>
          </label>

          {override.enabled && (
            <>
              {/* Quick presets */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">Quick Presets</label>
                <div className="flex flex-wrap gap-1.5">
                  {TIER_PRESETS.map((preset) => {
                    const isActive = override.amount === preset.amount && override.status === preset.status;
                    return (
                      <button
                        key={preset.label}
                        onClick={() => applyPreset(preset)}
                        className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                          isActive
                            ? 'border-amber-500 bg-amber-500/20 text-amber-700 dark:text-amber-300'
                            : 'border-border hover:border-amber-500/50 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
                <select
                  value={override.status}
                  onChange={(e) => update({ status: e.target.value })}
                  className="w-full text-sm rounded-md border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Amount: ${override.amount}/mo
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={override.amount}
                  onChange={(e) => update({ amount: Number(e.target.value) })}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                  <span>$0</span>
                  <span>$10</span>
                  <span>$20</span>
                  <span>$30</span>
                  <span>$100</span>
                </div>
              </div>

              {/* Cancel at period end */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={override.cancelAtPeriodEnd}
                  onChange={(e) => update({ cancelAtPeriodEnd: e.target.checked })}
                  className="rounded border-amber-500/50 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm text-foreground">Cancel at period end</span>
              </label>

              {/* Current state summary */}
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 space-y-1">
                <div className="font-medium text-foreground mb-1">Context will report:</div>
                <div>hasActiveSubscription: <code className="text-amber-600 dark:text-amber-400">{String(override.status === 'active' && override.amount > 0)}</code></div>
                <div>subscriptionAmount: <code className="text-amber-600 dark:text-amber-400">${override.amount}</code></div>
                <div>status: <code className="text-amber-600 dark:text-amber-400">{override.status}</code></div>
                <div>cancelAtPeriodEnd: <code className="text-amber-600 dark:text-amber-400">{String(override.cancelAtPeriodEnd)}</code></div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
