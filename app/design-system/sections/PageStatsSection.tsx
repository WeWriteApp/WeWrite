"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { StatsCard, StatsCardHeader } from '@/components/ui/StatsCard';
import { ComponentShowcase, StateDemo, CollapsibleDocs } from './shared';

/**
 * PageStats Design System Documentation
 *
 * Documents the StatsCard component and its variants used for displaying
 * page statistics like Views, Recent Edits, Supporters, Custom Date, etc.
 */
export function PageStatsSection({ id }: { id: string }) {
  // Sample sparkline data for demos
  const sampleSparkline = [12, 15, 18, 14, 22, 19, 25, 28, 32, 29, 35, 38, 42, 45, 48, 52, 49, 55, 58, 62, 59, 65, 68, 72];
  const flatSparkline = [5, 5, 6, 5, 5, 6, 5, 5, 6, 5, 5, 6, 5, 5, 6, 5, 5, 6, 5, 5, 6, 5, 5, 6];

  return (
    <ComponentShowcase
      id={id}
      title="Page Stats"
      path="app/components/ui/StatsCard.tsx"
      description="Unified cards for displaying page statistics with sparklines, animated values, and consistent styling"
    >
      {/* Anatomy */}
      <StateDemo label="Card Anatomy">
        <div className="w-full max-w-md">
          <div className="wewrite-card relative">
            {/* Anatomy labels */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Icon name="Eye" size={20} className="text-muted-foreground" />
                  <div className="absolute -top-6 left-0 text-[10px] text-primary font-medium whitespace-nowrap">Icon</div>
                </div>
                <div className="relative">
                  <span className="text-sm font-medium">Views</span>
                  <div className="absolute -top-6 left-0 text-[10px] text-primary font-medium whitespace-nowrap">Title</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="h-8 w-16 bg-muted/50 rounded flex items-center justify-center text-xs text-muted-foreground">
                    chart
                  </div>
                  <div className="absolute -top-6 left-0 text-[10px] text-primary font-medium whitespace-nowrap">Sparkline</div>
                </div>
                <div className="relative">
                  <div className="text-sm font-medium px-2 py-1 rounded-md bg-primary text-primary-foreground">
                    1,234
                  </div>
                  <div className="absolute -top-6 right-0 text-[10px] text-primary font-medium whitespace-nowrap">Value Pill</div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            All StatsCards share this consistent layout: icon + title on left, sparkline + value pill on right.
          </p>
        </div>
      </StateDemo>

      {/* Live Examples */}
      <StateDemo label="Live Examples">
        <div className="w-full space-y-3">
          <StatsCard
            icon="Eye"
            title="Views"
            value={1847}
            sparklineData={sampleSparkline}
          />
          <StatsCard
            icon="Clock"
            title="Recent edits"
            value="2h ago"
            sparklineData={flatSparkline}
          />
          <StatsCard
            icon="Heart"
            title="Supporters"
            value={12}
            sparklineData={[0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 12]}
          />
          <StatsCard
            icon="Calendar"
            title="Custom date"
            value="Jan 14, 2026"
            showSparkline={false}
          />
        </div>
      </StateDemo>

      {/* Loading State */}
      <StateDemo label="Loading State">
        <div className="w-full max-w-md">
          <StatsCard
            icon="Eye"
            title="Views"
            loading={true}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Cards maintain <code>min-h-[52px]</code> during loading to prevent layout shift.
          </p>
        </div>
      </StateDemo>

      {/* Empty / Editable States */}
      <StateDemo label="Empty States">
        <div className="w-full space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <StatsCard
              icon="Calendar"
              title="Custom date"
              value={null}
              isEditable={true}
              emptyPlaceholder="Set date"
              showSparkline={false}
              onClick={() => {}}
            />
            <StatsCard
              icon="MapPin"
              title="Location"
              value={null}
              isEditable={true}
              emptyPlaceholder="Set location"
              showSparkline={false}
              onClick={() => {}}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Editable cards show a dashed border placeholder when empty. Non-editable empty cards can be hidden with <code>hideWhenEmpty</code>.
          </p>
        </div>
      </StateDemo>

      {/* Interactive Cards */}
      <StateDemo label="Interactive (Clickable)">
        <div className="w-full max-w-md">
          <StatsCard
            icon="Calendar"
            title="Custom date"
            value="Jan 14, 2026"
            showSparkline={false}
            onClick={() => alert('Clicked!')}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Cards with <code>onClick</code> get hover styles and cursor pointer.
          </p>
        </div>
      </StateDemo>

      {/* With Children Content */}
      <StateDemo label="With Children (Diff Preview)">
        <div className="w-full max-w-md">
          <StatsCard
            icon="Clock"
            title="Recent edits"
            value="2h ago"
            sparklineData={flatSparkline}
          >
            <div className="text-sm">
              <span className="text-muted-foreground">...</span>
              <span className="bg-green-500/20 text-green-700 dark:text-green-300 px-0.5 rounded">added text</span>
              <span className="text-muted-foreground">...</span>
            </div>
          </StatsCard>
          <p className="text-xs text-muted-foreground mt-2">
            Children appear below a separator line. Used for diff previews in Recent Edits.
          </p>
        </div>
      </StateDemo>

      {/* Grid Layouts */}
      <StateDemo label="Grid Layouts">
        <div className="w-full space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">2-column (default for Views + Edits):</p>
            <div className="grid grid-cols-2 gap-3">
              <StatsCard icon="Eye" title="Views" value={1847} sparklineData={sampleSparkline} />
              <StatsCard icon="Clock" title="Recent edits" value="2h ago" sparklineData={flatSparkline} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">3-column (with Supporters):</p>
            <div className="grid grid-cols-3 gap-3">
              <StatsCard icon="Eye" title="Views" value={1847} sparklineData={sampleSparkline} />
              <StatsCard icon="Clock" title="Edits" value="2h" sparklineData={flatSparkline} />
              <StatsCard icon="Heart" title="Supporters" value={12} sparklineData={[1,2,3,4,5,6,7,8,9,10,11,12,12,12,12,12,12,12,12,12,12,12,12,12]} />
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Props Reference */}
      <CollapsibleDocs type="props">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-semibold">Prop</th>
                <th className="text-left py-2 px-3 font-semibold">Type</th>
                <th className="text-left py-2 px-3 font-semibold">Default</th>
                <th className="text-left py-2 px-3 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>icon</code></td>
                <td className="py-2 px-3">IconName</td>
                <td className="py-2 px-3">required</td>
                <td className="py-2 px-3">Icon to display in header</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>title</code></td>
                <td className="py-2 px-3">string</td>
                <td className="py-2 px-3">required</td>
                <td className="py-2 px-3">Title text for the header</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>value</code></td>
                <td className="py-2 px-3">number | string | null</td>
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3">Main value (numbers animate)</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>sparklineData</code></td>
                <td className="py-2 px-3">number[]</td>
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3">24h trend data (24 points)</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>showSparkline</code></td>
                <td className="py-2 px-3">boolean</td>
                <td className="py-2 px-3">true</td>
                <td className="py-2 px-3">Toggle sparkline visibility</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>loading</code></td>
                <td className="py-2 px-3">boolean</td>
                <td className="py-2 px-3">false</td>
                <td className="py-2 px-3">Show loading spinner</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>onClick</code></td>
                <td className="py-2 px-3">function</td>
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3">Click handler (enables hover)</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>isEditable</code></td>
                <td className="py-2 px-3">boolean</td>
                <td className="py-2 px-3">false</td>
                <td className="py-2 px-3">Shows dashed placeholder when empty</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>hideWhenEmpty</code></td>
                <td className="py-2 px-3">boolean</td>
                <td className="py-2 px-3">false</td>
                <td className="py-2 px-3">Hide card when value is empty/0</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>children</code></td>
                <td className="py-2 px-3">ReactNode</td>
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3">Content below separator (diff preview)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CollapsibleDocs>

      {/* Usage Guidelines */}
      <CollapsibleDocs type="guidelines">
        <div className="w-full space-y-3">
          <div className="wewrite-card bg-green-500/10 border-green-500/20">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Icon name="Check" size={16} className="text-green-500" />
              Do
            </h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>Use StatsCard for all page statistics</li>
              <li>Include sparklines for time-series data</li>
              <li>Use <code>hideWhenEmpty</code> for non-essential stats</li>
              <li>Use <code>isEditable</code> with <code>onClick</code> for user-editable fields</li>
            </ul>
          </div>
          <div className="wewrite-card bg-red-500/10 border-red-500/20">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Icon name="X" size={16} className="text-red-500" />
              Avoid
            </h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>Creating custom stat card layouts</li>
              <li>Showing empty cards without <code>isEditable</code> styling</li>
              <li>Using sparklines without meaningful trend data</li>
            </ul>
          </div>
        </div>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
