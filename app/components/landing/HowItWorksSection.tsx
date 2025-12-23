"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Card, CardContent } from '../ui/card';
import { EmbeddedAllocationBar } from '../payments/EmbeddedAllocationBar';
import { useDemoBalance } from '../../contexts/DemoBalanceContext';
import { getLoggedOutPageAllocation } from '../../utils/simulatedUsd';
import { formatUsdCents } from '../../utils/formatCurrency';
import { cn } from '../../lib/utils';
import { PillLink } from '../utils/PillLink';

// ChevronDown component using Icon
const ChevronDown = ({ className }: { className?: string }) => (
  <Icon name="ChevronDown" size={16} className={className} />
);

// Demo page configuration - uses a real page for the allocation bar
const DEMO_PAGE_ID = 'demo-how-it-works';
const DEMO_AUTHOR_ID = 'demo-author';
const DEMO_PAGE_TITLE = 'Example Page Title';

// Hard-coded "other pages" for the landing page demo - always shows $2.00 total
// Sorted by amount descending
const DEMO_OTHER_PAGES = [
  { id: 'demo-travel-places', title: 'Places to Travel To', amount: 75 },
  { id: 'demo-music-theory', title: 'Music Theory Basics', amount: 75 },
  { id: 'demo-community-garden', title: 'Local Community Garden', amount: 50 },
];
const DEMO_OTHER_PAGES_TOTAL = 200; // $2.00

/**
 * HowItWorksSection Component
 *
 * Shows a breakdown of the allocation card and explains what each section does.
 * Uses a real EmbeddedAllocationBar component for interactive demonstration.
 */
export default function HowItWorksSection() {
  const [showTooltip, setShowTooltip] = useState(true);
  const [otherPagesExpanded, setOtherPagesExpanded] = useState(false);
  const { demoBalance } = useDemoBalance();
  const [thisPageAllocation, setThisPageAllocation] = useState(0);

  // Get allocation for this demo page
  useEffect(() => {
    const allocation = getLoggedOutPageAllocation(DEMO_PAGE_ID);
    setThisPageAllocation(allocation);
  }, [demoBalance]);

  // Recalculate when demo balance changes
  useEffect(() => {
    const interval = setInterval(() => {
      const allocation = getLoggedOutPageAllocation(DEMO_PAGE_ID);
      setThisPageAllocation(allocation);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Pulse the tooltip periodically to draw attention
  useEffect(() => {
    const interval = setInterval(() => {
      setShowTooltip(prev => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Calculate values for the key - hard-coded other pages + dynamic "this page"
  const totalCents = 1000; // $10
  const otherPagesCents = DEMO_OTHER_PAGES_TOTAL; // Always $2.00
  const availableCents = Math.max(0, totalCents - otherPagesCents - thisPageAllocation);

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-6 max-w-4xl">
        {/* Wrapped in a wewrite-card for consistent styling */}
        <div className="wewrite-card p-6 md:p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How does it work?</h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              At the bottom of every page, you'll see a little bar. Hit the plus button to send that writer some of your monthly funds!
            </p>
          </div>

          <div className="space-y-6">
          {/* Allocation bar in a card with tooltip outside */}
          <div className="relative max-w-md mx-auto">
            {/* Click me tooltip - positioned outside the card, pointing at the plus button */}
            <div
              className={`absolute -top-8 right-4 z-20 transition-all duration-500 ${showTooltip ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}
            >
              <div className="flex flex-col items-center animate-bounce">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium shadow-lg">
                  <Icon name="Sparkles" size={24} className="h-3.5 w-3.5" />
                  Click me!
                </div>
                {/* Arrow pointing down - bounces with the chip */}
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-primary -mt-0.5" />
              </div>
            </div>

            <Card className="wewrite-card overflow-visible">
              <CardContent className="p-2">
                {/* Real EmbeddedAllocationBar - with detail modal disabled and click zones enabled */}
                <EmbeddedAllocationBar
                  pageId={DEMO_PAGE_ID}
                  authorId={DEMO_AUTHOR_ID}
                  pageTitle={DEMO_PAGE_TITLE}
                  source="LandingPage"
                  disableDetailModal={true}
                  disableLongPress={true}
                  enableBarClickZones={true}
                />
              </CardContent>
            </Card>
          </div>

          {/* Key/Legend as a dense list with values */}
          <div className="space-y-2 max-w-md mx-auto">
            <h4 className="text-sm font-medium text-muted-foreground">Breakdown</h4>

            {/* Other pages - clickable with chevron */}
            <div>
              <button
                onClick={() => setOtherPagesExpanded(!otherPagesExpanded)}
                className="flex items-center justify-between py-1.5 w-full text-left hover:bg-muted/30 rounded-md px-1 -mx-1 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-neutral-alpha-15 flex-shrink-0" />
                  <span className="text-sm">Other Pages</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      otherPagesExpanded && "rotate-180"
                    )}
                  />
                </div>
                <span className="font-medium text-sm tabular-nums">{formatUsdCents(otherPagesCents)}</span>
              </button>

              {/* Expanded breakdown of other pages - hard-coded with PillLinks */}
              <div
                className={cn(
                  "overflow-hidden transition-all duration-200",
                  otherPagesExpanded ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
                )}
              >
                <div className="pl-5 space-y-1.5 pt-1.5">
                  {DEMO_OTHER_PAGES.map((page) => (
                    <div key={page.id} className="flex items-center justify-between py-1">
                      <PillLink
                        href={`/${page.id}`}
                        clickable={false}
                      >
                        {page.title}
                      </PillLink>
                      <span className="text-sm text-muted-foreground tabular-nums">{formatUsdCents(page.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* This page - uses bg-primary */}
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-primary flex-shrink-0" />
                <span className="text-sm">This Page</span>
              </div>
              <span className="font-medium text-sm text-primary tabular-nums">{formatUsdCents(thisPageAllocation)}</span>
            </div>

            {/* Available - outline style to match allocation bar */}
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-transparent border border-neutral-alpha-10 flex-shrink-0" />
                <span className="text-sm">Available</span>
              </div>
              <span className="font-medium text-sm tabular-nums">{formatUsdCents(availableCents)}</span>
            </div>

            {/* Total - separator line */}
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-border">
              <span className="text-sm">Monthly Subscription</span>
              <span className="font-bold text-sm tabular-nums">{formatUsdCents(totalCents)}</span>
            </div>
          </div>

          {/* How it helps creators */}
          <div className="flex items-start gap-4 p-4 wewrite-card max-w-md mx-auto">
            <Icon name="Calendar" size={24} className="text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-sm mb-1">Get paid monthly for your writing</h4>
              <p className="text-sm text-muted-foreground">
                At the end of each month, you receive payouts based on how much support your pages received.
                The more readers allocate to your content, the more you earn!
              </p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
