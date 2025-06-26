"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Coins, ChevronLeft, ChevronRight } from 'lucide-react';
import { SUBSCRIPTION_TIERS, CUSTOM_TIER_CONFIG, validateCustomAmount, calculateTokensForAmount } from '../../utils/subscriptionTiers';

interface SubscriptionTierCarouselProps {
  selectedTier: string;
  onTierSelect: (tierId: string) => void;
  customAmount?: number;
  onCustomAmountChange?: (amount: number) => void;
  currentSubscription?: {
    amount: number;
    tier?: string;
  } | null;
  showCurrentOption?: boolean;
}

export default function SubscriptionTierCarousel({
  selectedTier,
  onTierSelect,
  customAmount = CUSTOM_TIER_CONFIG.minAmount,
  onCustomAmountChange,
  currentSubscription,
  showCurrentOption = false
}: SubscriptionTierCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [customAmountInput, setCustomAmountInput] = useState(customAmount.toString());
  const [customAmountError, setCustomAmountError] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Create tiers array with optional current subscription option
  const availableTiers = React.useMemo(() => {
    const tiers = [...SUBSCRIPTION_TIERS];

    if (showCurrentOption && currentSubscription) {
      const currentTier = {
        id: 'current',
        name: 'Current Subscription',
        amount: currentSubscription.amount,
        tokens: calculateTokensForAmount(currentSubscription.amount),
        description: `Reactivate your ${currentSubscription.tier || 'custom'} subscription`,
        isCurrent: true
      };

      // Add current tier at the beginning
      tiers.unshift(currentTier);
    }

    return tiers;
  }, [showCurrentOption, currentSubscription]);

  // Update customAmountInput when customAmount prop changes
  useEffect(() => {
    setCustomAmountInput(customAmount.toString());
  }, [customAmount]);

  const handleCustomAmountChange = (value: string) => {
    setCustomAmountInput(value);
    const amount = parseFloat(value);
    
    if (isNaN(amount)) {
      setCustomAmountError('Please enter a valid amount');
      return;
    }

    const validation = validateCustomAmount(amount);
    if (!validation.valid) {
      setCustomAmountError(validation.error || 'Invalid amount');
      return;
    }

    setCustomAmountError(null);
    onCustomAmountChange?.(amount);
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % availableTiers.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + availableTiers.length) % availableTiers.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  // Touch handlers for swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextSlide();
      }
    };

    // Only add keyboard listeners on mobile/tablet view
    const mediaQuery = window.matchMedia('(max-width: 1024px)');
    if (mediaQuery.matches) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const renderTierCard = (tier: any, index: number) => {
    const isCustomTier = tier.isCustom;
    const isCurrentTier = tier.isCurrent;
    const displayAmount = isCustomTier ? customAmount : tier.amount;
    const displayTokens = isCustomTier ? calculateTokensForAmount(customAmount) : tier.tokens;

    return (
      <div
        key={tier.id}
        className={`relative w-full max-w-sm mx-auto flex flex-col p-6 rounded-lg border-2 transition-all duration-200 text-left cursor-pointer ${
          selectedTier === tier.id
            ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
            : 'border-border bg-card hover:border-primary/50 hover:bg-accent/50'
        } ${tier.popular ? 'ring-2 ring-primary/30' : ''}`}
        onClick={() => onTierSelect(tier.id)}
      >
        {tier.popular && !isCurrentTier && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
              Most Popular
            </span>
          </div>
        )}

        {isCurrentTier && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <span className="bg-blue-500 text-white text-xs font-medium px-3 py-1 rounded-full">
              Your Current Plan
            </span>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{tier.name}</h3>
          <div className="flex items-center gap-1">
            <Coins className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{displayTokens}</span>
          </div>
        </div>

        <div className="mb-4">
          {isCustomTier ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">$</span>
                <Input
                  type="number"
                  min={CUSTOM_TIER_CONFIG.minAmount}
                  max={CUSTOM_TIER_CONFIG.maxAmount}
                  step="1"
                  value={customAmountInput}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  className="text-2xl font-bold border-0 p-0 h-auto bg-transparent focus:ring-0"
                  placeholder={CUSTOM_TIER_CONFIG.minAmount.toString()}
                />
                <span className="text-muted-foreground">/month</span>
              </div>
              {customAmountError && (
                <p className="text-red-500 text-xs">{customAmountError}</p>
              )}
            </div>
          ) : (
            <>
              <span className="text-3xl font-bold">${displayAmount}</span>
              <span className="text-muted-foreground">/month</span>
            </>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4">{tier.description}</p>

        <ul className="space-y-2 text-sm flex-1">
          {tier.features.map((feature: string, featureIndex: number) => (
            <li key={featureIndex} className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-medium mb-4">Choose Your Subscription</h2>
        
        {/* Mobile and Small Tablet Carousel */}
        <div className="lg:hidden">
          <div className="relative">
            <div
              className="overflow-hidden rounded-lg"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div
                className="flex transition-transform duration-300 ease-in-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {availableTiers.map((tier, index) => (
                  <div key={tier.id} className="w-full flex-shrink-0 px-2">
                    {renderTierCard(tier, index)}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Navigation Arrows */}
            <button
              onClick={prevSlide}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 bg-background border border-border rounded-full p-2 shadow-md hover:bg-accent"
              aria-label="Previous tier"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 bg-background border border-border rounded-full p-2 shadow-md hover:bg-accent"
              aria-label="Next tier"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          
          {/* Pagination Dots */}
          <div className="flex justify-center gap-2 mt-4">
            {availableTiers.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-primary' : 'bg-muted'
                }`}
                aria-label={`Go to tier ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Desktop Grid - Only show on large screens */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-6">
          {availableTiers.map((tier, index) => renderTierCard(tier, index))}
        </div>
      </div>
    </div>
  );
}
