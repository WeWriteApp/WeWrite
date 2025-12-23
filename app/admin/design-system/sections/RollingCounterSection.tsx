"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../../components/ui/button';
import { RollingCounter } from '../../../components/ui/rolling-counter';
import { CounterBadge } from '../../../components/ui/counter-badge';
import { ComponentShowcase, StateDemo } from './shared';

export function RollingCounterSection({ id }: { id: string }) {
  const [counterValue, setCounterValue] = useState(1234);
  const [dollarValue, setDollarValue] = useState(99.99);
  const [animationSpeed, setAnimationSpeed] = useState(400);

  return (
    <ComponentShowcase
      id={id}
      title="Rolling Counter"
      path="app/components/ui/rolling-counter.tsx"
      description="Animated counter with slot machine style rolling digits. Also known as 'odometer' in other design systems. Features direction-aware animation (rolls up when increasing, down when decreasing) and adaptive speed for rapid changes. Perfect for view counts, stats, and financial displays."
    >
      <div className="space-y-6">
        {/* Interactive Demo */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Interactive Demo</h4>
          <div className="flex flex-wrap items-center gap-6">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Views Counter</p>
              <div className="flex items-center gap-3">
                <Button size="sm" variant="outline" onClick={() => setCounterValue(prev => Math.max(0, prev - 1))}>
                  <Icon name="Minus" size={16} />
                </Button>
                <span className="text-3xl font-bold min-w-[180px]">
                  <RollingCounter value={counterValue} suffix=" views" duration={animationSpeed} />
                </span>
                <Button size="sm" variant="outline" onClick={() => setCounterValue(prev => prev + 1)}>
                  <Icon name="Plus" size={16} />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Dollar Amount</p>
              <div className="flex items-center gap-3">
                <Button size="sm" variant="outline" onClick={() => setDollarValue(prev => Math.max(0, prev - 1))}>
                  <Icon name="Minus" size={16} />
                </Button>
                <span className="text-3xl font-bold min-w-[120px]">
                  <RollingCounter value={dollarValue} prefix="$" decimals={2} duration={animationSpeed} />
                </span>
                <Button size="sm" variant="outline" onClick={() => setDollarValue(prev => prev + 1)}>
                  <Icon name="Plus" size={16} />
                </Button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Speed:</span>
              <Button size="sm" variant="outline" onClick={() => setAnimationSpeed(prev => Math.max(100, prev - 100))}>
                <Icon name="Minus" size={12} />
              </Button>
              <span className="text-sm font-mono w-16 text-center">{animationSpeed}ms</span>
              <Button size="sm" variant="outline" onClick={() => setAnimationSpeed(prev => Math.min(1000, prev + 100))}>
                <Icon name="Plus" size={12} />
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setCounterValue(1234); setDollarValue(99.99); setAnimationSpeed(400); }}>Reset</Button>
          </div>
        </div>

        {/* Size Examples */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Size Variants</h4>
          <div className="flex flex-col gap-3">
            <div className="text-sm"><RollingCounter value={counterValue} /> <span className="text-muted-foreground ml-2">text-sm</span></div>
            <div className="text-base"><RollingCounter value={counterValue} /> <span className="text-muted-foreground ml-2">text-base</span></div>
            <div className="text-xl"><RollingCounter value={counterValue} /> <span className="text-muted-foreground ml-2">text-xl</span></div>
            <div className="text-3xl font-bold"><RollingCounter value={counterValue} /> <span className="text-muted-foreground text-base ml-2">text-3xl font-bold</span></div>
          </div>
        </div>

        {/* Format Examples */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Format Examples</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-lg">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">With commas (default)</p>
              <RollingCounter value={1234567} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Without commas</p>
              <RollingCounter value={1234567} formatWithCommas={false} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">With prefix</p>
              <RollingCounter value={1234.56} prefix="$" decimals={2} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">With suffix</p>
              <RollingCounter value={42} suffix=" items" />
            </div>
          </div>
        </div>

        {/* CounterBadge - Composed Badge + RollingCounter */}
        <div className="space-y-3 pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-muted-foreground">CounterBadge (Badge + RollingCounter)</h4>
          <p className="text-xs text-muted-foreground">
            Composes Badge with RollingCounter for animated pill counters. Inherits all Badge variants and shiny mode support.
          </p>

          {/* Variant Examples */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Variants (click to increment)</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setCounterValue(prev => prev + 1)}>
                <CounterBadge value={counterValue} variant="default" />
              </button>
              <button onClick={() => setCounterValue(prev => prev + 1)}>
                <CounterBadge value={counterValue} variant="secondary" />
              </button>
              <button onClick={() => setCounterValue(prev => prev + 1)}>
                <CounterBadge value={counterValue} variant="outline" />
              </button>
              <button onClick={() => setCounterValue(prev => prev + 1)}>
                <CounterBadge value={counterValue} variant="destructive" />
              </button>
              <button onClick={() => setCounterValue(prev => prev + 1)}>
                <CounterBadge value={counterValue} variant="success" />
              </button>
            </div>
          </div>

          {/* Size Examples */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Sizes</p>
            <div className="flex flex-wrap items-center gap-2">
              <CounterBadge value={counterValue} size="sm" />
              <CounterBadge value={counterValue} size="default" />
              <CounterBadge value={counterValue} size="lg" />
            </div>
          </div>

          {/* With Prefix/Suffix */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">With Prefix/Suffix</p>
            <div className="flex flex-wrap gap-2">
              <CounterBadge value={dollarValue} prefix="$" decimals={2} variant="success" />
              <CounterBadge value={counterValue} suffix=" views" variant="secondary" />
              <CounterBadge value={counterValue} suffix=" new" variant="destructive" />
            </div>
          </div>

          {/* Static (non-animated) */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Static (no animation)</p>
            <div className="flex flex-wrap gap-2">
              <CounterBadge value={42} animated={false} />
              <CounterBadge value={99} animated={false} variant="secondary" />
              <CounterBadge value={5} animated={false} variant="outline" suffix=" items" />
            </div>
          </div>
        </div>
      </div>
    </ComponentShowcase>
  );
}
