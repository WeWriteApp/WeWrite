"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { USD_SUBSCRIPTION_TIERS, getEffectiveUsdTier } from '../../utils/usdConstants';
import { formatUsdCents, dollarsToCents, parseDollarInputToCents } from '../../utils/formatCurrency';
import { determineTierFromAmount } from '../../utils/subscriptionTiers';
import { UsernameBadge } from '../ui/UsernameBadge';
import { useAuth } from '../../providers/AuthProvider';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import Link from 'next/link';
import { SubscriptionCheckoutDrawer } from './SubscriptionCheckoutDrawer';
import { ConfirmationModal } from '../utils/UnifiedModal';

interface UsdFundingTierSliderProps {
  selectedAmount: number;
  onAmountSelect: (amount: number) => void;
  currentSubscription?: {
    amount: number;
    tier?: string;
  } | null;
  showCurrentOption?: boolean;
  defaultExpanded?: boolean;
}

// Define the 5 fixed slider positions with labels
const SLIDER_TIERS = [
  { value: 0, label: 'Free', description: 'No subscription' },
  { value: 10, label: '$10', description: 'Supporter tier' },
  { value: 20, label: '$20', description: 'Advocate tier' },
  { value: 30, label: '$30', description: 'Champion tier' },
  { value: 31, label: 'Above $30', description: 'Custom amount' }, // Special marker for custom
];

// Get tier information for an amount
const getTierInfo = (amount: number) => {
  if (amount === 0) return {
    tier: 'free',
    usdCents: 0,
    description: 'No account funding',
    name: 'Free'
  };

  const effectiveTier = getEffectiveUsdTier(amount);
  const usdCents = dollarsToCents(amount);

  return {
    tier: effectiveTier.id,
    usdCents,
    description: `${formatUsdCents(usdCents)}/month funding`,
    name: effectiveTier.name
  };
};

export default function UsdFundingTierSlider({
  selectedAmount,
  onAmountSelect,
  currentSubscription,
  showCurrentOption = false,
  defaultExpanded = false
}: UsdFundingTierSliderProps) {
  const { user } = useAuth();
  const { usdBalance, refreshUsdBalance } = useUsdBalance();
  const { hasActiveSubscription } = useSubscription();
  const [isEditing, setIsEditing] = useState(defaultExpanded);
  const [customAmount, setCustomAmount] = useState('');
  const [customError, setCustomError] = useState('');
  const customInputRef = useRef<HTMLInputElement>(null);
  const [checkoutDrawerOpen, setCheckoutDrawerOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'update' | 'cancel' | null>(null);
  const hasAppliedTopoff = useRef(false);

  const currentSubscriptionAmount = currentSubscription?.amount || 0;

  // Reset editing state when subscription changes (but not if defaultExpanded)
  useEffect(() => {
    if (!defaultExpanded) {
      setIsEditing(false);
      setCustomAmount('');
      setCustomError('');
    }
  }, [currentSubscriptionAmount, defaultExpanded]);

  // Handle defaultExpanded prop - when true, expand edit mode and set amount to +$10
  // This runs when defaultExpanded is true AND we have a valid subscription amount
  useEffect(() => {
    if (defaultExpanded && currentSubscriptionAmount > 0 && !hasAppliedTopoff.current) {
      hasAppliedTopoff.current = true;
      setIsEditing(true);
      const topoffAmount = currentSubscriptionAmount + 10;
      setCustomAmount(topoffAmount.toFixed(2));
      onAmountSelect(topoffAmount);
    }
  }, [defaultExpanded, currentSubscriptionAmount, onAmountSelect]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setTimeout(() => {
        customInputRef.current?.focus();
        customInputRef.current?.select();
      }, 150);
    }
  }, [isEditing]);

  // Format amount with cents for display
  const formatAmountDisplay = (amount: number) => {
    return amount.toFixed(2);
  };

  // Handle increment/decrement by $10
  const handleIncrement = useCallback(() => {
    const newAmount = selectedAmount + 10;
    if (newAmount <= 1000) {
      onAmountSelect(newAmount);
      setCustomAmount(formatAmountDisplay(newAmount));
      setCustomError('');
    }
  }, [selectedAmount, onAmountSelect]);

  const handleDecrement = useCallback(() => {
    const newAmount = selectedAmount - 10;
    if (newAmount >= 10) {
      onAmountSelect(newAmount);
      setCustomAmount(formatAmountDisplay(newAmount));
      setCustomError('');
    }
  }, [selectedAmount, onAmountSelect]);

  // Handle custom amount input
  const handleCustomAmountChange = useCallback((value: string) => {
    setCustomAmount(value);
    setCustomError('');

    const parsedCents = parseDollarInputToCents(value);
    if (parsedCents === null) {
      if (value.trim() !== '') {
        setCustomError('Please enter a valid dollar amount');
      }
      return;
    }

    const dollarAmount = parsedCents / 100;

    if (dollarAmount < 10) {
      setCustomError('Minimum subscription is $10/month');
      return;
    }

    if (dollarAmount > 1000) {
      setCustomError('Maximum subscription is $1000/month');
      return;
    }

    // Valid amount
    onAmountSelect(dollarAmount);
  }, [onAmountSelect]);

  // Handle slider selection (for new subscribers only)
  const handleSliderSelect = useCallback((index: number) => {
    const tier = SLIDER_TIERS[index];
    if (tier.value === 31) {
      // "Above $30" selected - default to $40
      onAmountSelect(40);
      setCustomAmount('40');
    } else {
      onAmountSelect(tier.value);
      setCustomAmount('');
    }
  }, [onAmountSelect]);

  // Get current slider index
  const getSliderIndex = () => {
    if (selectedAmount === 0) return 0;
    if (selectedAmount === 10) return 1;
    if (selectedAmount === 20) return 2;
    if (selectedAmount === 30) return 3;
    return 4; // Above $30
  };

  // Handle edit button click
  const handleEditClick = () => {
    setIsEditing(true);
    setCustomAmount(formatAmountDisplay(currentSubscriptionAmount));
    onAmountSelect(currentSubscriptionAmount);
  };

  // Handle cancel subscription click
  const handleCancelClick = () => {
    setPendingAction('cancel');
    setShowConfirmModal(true);
  };

  // Handle save/update click
  const handleSaveClick = () => {
    if (selectedAmount === currentSubscriptionAmount) {
      setCustomError('Please enter a different amount');
      return;
    }
    if (selectedAmount < 10) {
      setCustomError('Minimum subscription is $10/month');
      return;
    }
    setPendingAction('update');
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    setShowConfirmModal(false);
    if (pendingAction === 'cancel') {
      // Navigate to cancel page
      window.location.href = '/settings/fund-account/cancel';
    } else {
      // Open checkout drawer
      setCheckoutDrawerOpen(true);
    }
    setPendingAction(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setCustomAmount('');
    setCustomError('');
    onAmountSelect(currentSubscriptionAmount);
  };

  // Get tier info
  const selectedTierInfo = getTierInfo(selectedAmount);
  const currentTierInfo = currentSubscription ? getTierInfo(currentSubscription.amount) : null;

  // Calculate overspending
  const totalUsdCents = currentSubscriptionAmount * 100;
  const allocatedUsdCents = usdBalance?.allocatedUsdCents || 0;
  const availableUsdCents = totalUsdCents - allocatedUsdCents;
  const isOverspent = availableUsdCents < 0 && currentSubscriptionAmount > 0;
  const overspentCents = isOverspent ? Math.abs(availableUsdCents) : 0;

  // Calculate potential overspending for selected amount (downgrade preview)
  const selectedTotalUsdCents = selectedAmount * 100;
  const selectedAvailableUsdCents = selectedTotalUsdCents - allocatedUsdCents;
  const wouldBeOverspent = selectedAvailableUsdCents < 0 && selectedAmount > 0;
  const wouldBeOverspentCents = wouldBeOverspent ? Math.abs(selectedAvailableUsdCents) : 0;

  // Show warning if new amount is below current allocations
  const showAllocationWarning = isEditing && selectedAmount < currentSubscriptionAmount && wouldBeOverspent;

  // Determine if showing for active subscriber or new subscriber
  const isActiveSubscriber = hasActiveSubscription && currentSubscriptionAmount > 0;

  // Determine if this is an upgrade or downgrade
  const isUpgrade = selectedAmount > currentSubscriptionAmount;
  const isDowngrade = selectedAmount < currentSubscriptionAmount;

  return (
    <div className="space-y-4">
      {/* Current subscription card - expands to show edit controls */}
      {showCurrentOption && currentSubscription && currentTierInfo && (
        <div className="wewrite-card space-y-3 transition-all duration-300 ease-in-out">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="User" size={16} className="text-muted-foreground" />
              <span className="text-sm font-medium">Current Plan</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {formatUsdCents(currentTierInfo.usdCents)}/month
              </span>
            </div>
          </div>

          {isOverspent && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="AlertTriangle" size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium">Over spent</span>
              </div>
              <span className="text-sm font-semibold text-orange-500">
                {formatUsdCents(overspentCents)}
              </span>
            </div>
          )}

          {/* Edit button - animate out when editing */}
          <div
            className={`grid transition-all duration-200 ease-out ${
              isActiveSubscriber && !isEditing
                ? 'grid-rows-[1fr] opacity-100'
                : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <Button
                variant="outline"
                onClick={handleEditClick}
                className="w-full"
              >
                <Icon name="Edit" size={16} className="mr-2" />
                Edit subscription
              </Button>
            </div>
          </div>

          {/* Edit controls - expand inside the current plan card with height animation */}
          <div
            className={`grid transition-all duration-200 ease-out ${
              isActiveSubscriber && isEditing
                ? 'grid-rows-[1fr] opacity-100'
                : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="space-y-4 pt-3 border-t border-border">
                {/* Amount input row */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleDecrement}
                    disabled={selectedAmount <= 10}
                    className="h-10 w-10 flex-shrink-0"
                  >
                    <Icon name="Minus" size={16} />
                  </Button>

                  <div className="flex-1">
                    <Input
                      ref={customInputRef}
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={customAmount}
                      onChange={(e) => handleCustomAmountChange(e.target.value)}
                      leftIcon={<Icon name="DollarSign" size={16} />}
                      rightIcon={<span className="text-muted-foreground text-sm font-medium">USD</span>}
                      className={`text-center text-lg font-semibold ${customError ? 'border-destructive' : ''}`}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleIncrement}
                    disabled={selectedAmount >= 1000}
                    className="h-10 w-10 flex-shrink-0"
                  >
                    <Icon name="Plus" size={16} />
                  </Button>
                </div>

                {/* Error message */}
                {customError && (
                  <p className="text-sm text-destructive text-center">{customError}</p>
                )}

                {/* Allocation warning */}
                {showAllocationWarning && (
                  <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Icon name="AlertTriangle" size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-orange-700 dark:text-orange-300">
                        <p className="font-medium mb-1">Unfunded allocations warning</p>
                        <p>Reducing to ${selectedAmount}/month will leave {formatUsdCents(wouldBeOverspentCents)} of your allocations unfunded. Some of your allocations to writers will be cancelled.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Comparison to current subscription */}
                {currentSubscriptionAmount > 0 && selectedAmount !== currentSubscriptionAmount && (
                  <div className={`text-xs text-center font-medium ${
                    selectedAmount > currentSubscriptionAmount
                      ? 'text-green-600'
                      : 'text-orange-600'
                  }`}>
                    {selectedAmount > currentSubscriptionAmount ? '+' : ''}${(selectedAmount - currentSubscriptionAmount).toFixed(0)} {selectedAmount > currentSubscriptionAmount ? 'over' : 'under'} current subscription of ${currentSubscriptionAmount}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    className="flex-1"
                  >
                    Nevermind
                  </Button>
                  <Button
                    onClick={handleSaveClick}
                    disabled={selectedAmount === currentSubscriptionAmount || !!customError || selectedAmount < 10}
                    className={`flex-1 text-white ${
                      isUpgrade
                        ? 'bg-green-600 hover:bg-green-700'
                        : isDowngrade
                        ? 'bg-yellow-600 hover:bg-yellow-700'
                        : ''
                    }`}
                  >
                    {isUpgrade ? 'Upgrade' : isDowngrade ? 'Downgrade' : 'Update'}
                  </Button>
                </div>

                {/* Cancel subscription button */}
                <Button
                  variant="destructive"
                  onClick={handleCancelClick}
                  className="w-full"
                >
                  <Icon name="X" size={16} className="mr-2" />
                  Cancel subscription
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Username Preview */}
      {user?.username && user?.uid && (
        <div className="wewrite-card">
          <p className="text-sm text-muted-foreground mb-3 text-center">Your username will appear as:</p>
          <div className="flex items-center justify-center gap-2">
            <UsernameBadge
              userId={user.uid}
              username={user.username}
              tier={hasActiveSubscription ? determineTierFromAmount(selectedAmount) : 'inactive'}
              size="md"
              showBadge={true}
              variant="link"
              onClick={(e) => e.preventDefault()}
            />
          </div>
        </div>
      )}

      {/* Funding Selection Card - only show for NEW subscribers */}
      {!isActiveSubscriber && (
        <div className="wewrite-card space-y-4">
          {/* Slider */}
          <div className="space-y-2">
            <div className="relative">
              <div className="w-full h-2 bg-muted rounded-full relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(getSliderIndex() / (SLIDER_TIERS.length - 1)) * 100}%` }}
                />
              </div>
              <input
                type="range"
                min="0"
                max={SLIDER_TIERS.length - 1}
                value={getSliderIndex()}
                onChange={(e) => handleSliderSelect(parseInt(e.target.value))}
                className="absolute top-0 left-0 w-full h-2 appearance-none cursor-pointer slider"
                style={{ background: 'transparent' }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              {SLIDER_TIERS.map((tier, index) => (
                <span key={index} className="text-center">
                  {tier.label}
                </span>
              ))}
            </div>
          </div>

          {/* Custom amount input for Above $30 */}
          {selectedAmount > 30 && (
            <div className="space-y-2">
              <Input
                ref={customInputRef}
                type="text"
                placeholder="Enter amount above $30"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  const parsed = parseDollarInputToCents(e.target.value);
                  if (parsed !== null) {
                    const dollars = parsed / 100;
                    if (dollars > 30 && dollars <= 1000) {
                      onAmountSelect(dollars);
                      setCustomError('');
                    } else if (dollars <= 30) {
                      setCustomError('Amount must be above $30');
                    } else {
                      setCustomError('Maximum is $1000/month');
                    }
                  }
                }}
                leftIcon={<Icon name="DollarSign" size={16} />}
                className={customError ? 'border-destructive' : ''}
              />
              {customError && (
                <p className="text-sm text-destructive">{customError}</p>
              )}
            </div>
          )}

          {/* Subscribe button */}
          {selectedAmount > 0 && (
            <Button
              onClick={() => setCheckoutDrawerOpen(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              Subscribe at ${selectedAmount}/month
            </Button>
          )}

          {/* USD info */}
          <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
            <p>
              All amounts are in USD. Payments processed securely via Stripe.
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setPendingAction(null);
        }}
        onConfirm={handleConfirm}
        title={
          pendingAction === 'cancel'
            ? 'Cancel Subscription?'
            : isUpgrade
            ? 'Confirm Upgrade'
            : 'Confirm Downgrade'
        }
        message={
          pendingAction === 'cancel'
            ? 'Are you sure you want to cancel your subscription? Your subscription will remain active until the end of your current billing period.'
            : isUpgrade
            ? `Are you sure you want to upgrade from $${currentSubscriptionAmount}/month to $${selectedAmount}/month?`
            : `Are you sure you want to downgrade from $${currentSubscriptionAmount}/month to $${selectedAmount}/month?${wouldBeOverspent ? ` This will leave ${formatUsdCents(wouldBeOverspentCents)} of your allocations unfunded.` : ''}`
        }
        confirmText={
          pendingAction === 'cancel'
            ? 'Yes, Cancel'
            : isUpgrade
            ? 'Upgrade'
            : 'Downgrade'
        }
        variant={
          pendingAction === 'cancel'
            ? 'destructive'
            : isUpgrade
            ? 'default'
            : 'warning'
        }
      />

      {/* Checkout Drawer */}
      <SubscriptionCheckoutDrawer
        open={checkoutDrawerOpen}
        onOpenChange={setCheckoutDrawerOpen}
        amount={selectedAmount}
        currentSubscriptionAmount={currentSubscription?.amount}
        onSuccess={() => {
          refreshUsdBalance();
          setIsEditing(false);
        }}
      />
    </div>
  );
}
