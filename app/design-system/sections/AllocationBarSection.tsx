"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../components/ui/button';
import { CompositionBar } from '../../components/payments/CompositionBar';
import { RollingCounter } from '../../components/ui/rolling-counter';
import { ComponentShowcase, StateDemo } from './shared';

export function AllocationBarSection({ id }: { id: string }) {
  const [demoAllocation, setDemoAllocation] = useState(30);
  const [showPulse, setShowPulse] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const otherPages = 20; // Fixed percentage for "other pages"
  const total = 100;
  const maxAllocation = 120; // Allow overspend up to 120% to demonstrate overfunded state
  const totalBudget = 10; // $10.00 total budget for demo

  const handleIncrement = () => {
    if (demoAllocation < maxAllocation) {
      setDemoAllocation(prev => Math.min(prev + 10, maxAllocation));
      setShowPulse(true);
      setShowParticles(true);
    }
  };

  const handleDecrement = () => {
    if (demoAllocation > 0) {
      setDemoAllocation(prev => Math.max(prev - 10, 0));
    }
  };

  // Calculate the display percentages based on total + overfunded for proper scaling
  const availableFunds = total - otherPages; // 80% available after other pages
  const currentFunded = Math.min(demoAllocation, availableFunds);
  const overfunded = Math.max(0, demoAllocation - availableFunds);
  const available = Math.max(0, availableFunds - currentFunded);

  // Calculate dollar amounts
  const allocatedDollars = (demoAllocation / 100) * totalBudget;
  const availableDollars = (availableFunds / 100) * totalBudget;

  // Scale all percentages to fit within display (total should be 100 or more if overfunded)
  const displayTotal = Math.max(total, otherPages + currentFunded + overfunded);
  const scaledOther = (otherPages / displayTotal) * 100;
  const scaledFunded = (currentFunded / displayTotal) * 100;
  const scaledOverfunded = (overfunded / displayTotal) * 100;
  const scaledAvailable = (available / displayTotal) * 100;

  return (
    <ComponentShowcase
      id={id}
      title="Allocation Bar"
      path="app/components/payments/AllocationControls.tsx"
      description="Interactive allocation interface with plus/minus buttons and visual composition bar. Features particle animations on allocation increases."
    >
      <div className="space-y-6">
        {/* Interactive Demo */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Interactive Demo</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Click + to allocate. Keep clicking past 80% to see overfunded (amber) state.
          </p>

          {/* Dollar amount display with RollingCounter */}
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-2xl font-bold">
              <RollingCounter value={allocatedDollars} prefix="$" decimals={2} duration={300} />
            </span>
            <span className="text-sm text-muted-foreground">
              / ${availableDollars.toFixed(2)} available
            </span>
            {overfunded > 0 && (
              <span className="text-sm text-amber-500 ml-1">
                (<RollingCounter value={(overfunded / 100) * totalBudget} prefix="$" decimals={2} duration={300} /> overfunded)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full max-w-md">
            {/* Minus button */}
            <Button
              size="sm"
              variant="secondary"
              className="h-8 w-8 p-0 bg-secondary/50 hover:bg-secondary/80 active:scale-95 transition-all duration-150 flex-shrink-0 border border-neutral-20"
              onClick={handleDecrement}
              disabled={demoAllocation <= 0}
            >
              <Icon name="Minus" size={16} />
            </Button>

            {/* Composition bar */}
            <CompositionBar
              data={{
                otherPagesPercentage: scaledOther,
                currentPageFundedPercentage: scaledFunded,
                currentPageOverfundedPercentage: scaledOverfunded,
                availablePercentage: scaledAvailable,
                isOutOfFunds: available <= 0
              }}
              showPulse={showPulse}
              showParticles={showParticles}
              onAnimationComplete={() => {
                setShowPulse(false);
                setShowParticles(false);
              }}
            />

            {/* Plus button */}
            <Button
              size="sm"
              variant="secondary"
              className="h-8 w-8 p-0 bg-secondary/50 hover:bg-secondary/80 active:scale-95 transition-all duration-150 flex-shrink-0 border border-neutral-20"
              onClick={handleIncrement}
              disabled={demoAllocation >= maxAllocation}
            >
              <Icon name="Plus" size={16} />
            </Button>
          </div>
        </div>

        {/* Static Examples */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Static Examples</h4>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Normal allocation (30% allocated, 50% available)</p>
              <CompositionBar
                data={{
                  otherPagesPercentage: 20,
                  currentPageFundedPercentage: 30,
                  currentPageOverfundedPercentage: 0,
                  availablePercentage: 50,
                  isOutOfFunds: false
                }}
              />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Nearly full (70% allocated, 10% available)</p>
              <CompositionBar
                data={{
                  otherPagesPercentage: 20,
                  currentPageFundedPercentage: 70,
                  currentPageOverfundedPercentage: 0,
                  availablePercentage: 10,
                  isOutOfFunds: false
                }}
              />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Fully allocated (80% allocated, 0% available)</p>
              <CompositionBar
                data={{
                  otherPagesPercentage: 20,
                  currentPageFundedPercentage: 80,
                  currentPageOverfundedPercentage: 0,
                  availablePercentage: 0,
                  isOutOfFunds: true
                }}
              />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Overfunded (80% funded + 20% overfunded)</p>
              <CompositionBar
                data={{
                  otherPagesPercentage: 20,
                  currentPageFundedPercentage: 60,
                  currentPageOverfundedPercentage: 20,
                  availablePercentage: 0,
                  isOutOfFunds: true
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </ComponentShowcase>
  );
}
