"use client";

import React from 'react';
import { ComponentShowcase, StateDemo } from './shared';
import SimpleSparkline from '@/components/utils/SimpleSparkline';
import { Sparkline as BarSparkline } from '@/components/ui/sparkline';
import { Sparkline as AdminSparkline, SparklineWithLabel } from '@/components/admin/Sparkline';
import { Icon } from '@/components/ui/Icon';

// Sample data for demonstrations
const SAMPLE_DATA_UP = [3, 5, 2, 8, 6, 9, 4, 12, 8, 15, 11, 18];
const SAMPLE_DATA_DOWN = [18, 15, 12, 14, 10, 8, 11, 6, 9, 4, 7, 3];
const SAMPLE_DATA_NEUTRAL = [8, 10, 7, 12, 9, 11, 8, 13, 10, 9, 11, 8];
const SAMPLE_DATA_SPARSE = [0, 0, 2, 0, 5, 0, 0, 3, 0, 0, 1, 0];
const SAMPLE_DATA_24H = [1, 0, 0, 0, 0, 0, 2, 5, 8, 12, 15, 18, 22, 19, 16, 14, 12, 15, 18, 16, 10, 5, 3, 2];

export function ChartsSection({ id }: { id: string }) {
  // Convert array data to admin sparkline format
  const toAdminFormat = (data: number[]) => data.map((value, i) => ({ value, date: `Day ${i + 1}` }));

  return (
    <ComponentShowcase
      id={id}
      title="Charts & Sparklines"
      path="app/components/ui/sparkline.tsx, app/components/utils/SimpleSparkline.tsx, app/components/admin/Sparkline.tsx"
      description="Visualization components for displaying trends, metrics, and data over time. We have multiple sparkline implementations - this section helps identify opportunities for consolidation."
    >
      {/* Line Sparklines (SimpleSparkline) */}
      <StateDemo label="Line Sparkline (SimpleSparkline - SVG area chart)">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          <div className="p-3 rounded-lg border border-border bg-card">
            <p className="text-xs text-muted-foreground mb-2">Default (primary color)</p>
            <SimpleSparkline data={SAMPLE_DATA_24H} height={50} />
          </div>
          <div className="p-3 rounded-lg border border-border bg-card">
            <p className="text-xs text-muted-foreground mb-2">Custom height (30px)</p>
            <SimpleSparkline data={SAMPLE_DATA_24H} height={30} />
          </div>
          <div className="p-3 rounded-lg border border-border bg-card">
            <p className="text-xs text-muted-foreground mb-2">Thick stroke (2.5px)</p>
            <SimpleSparkline data={SAMPLE_DATA_24H} height={50} strokeWidth={2.5} />
          </div>
        </div>
      </StateDemo>

      {/* Bar Sparklines (UI component) */}
      <StateDemo label="Bar Sparkline (ui/sparkline - SVG bars)">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          <div className="p-3 rounded-lg border border-border bg-card">
            <p className="text-xs text-muted-foreground mb-2">Default (primary color)</p>
            <BarSparkline data={SAMPLE_DATA_UP} height={40} />
          </div>
          <div className="p-3 rounded-lg border border-border bg-card">
            <p className="text-xs text-muted-foreground mb-2">Sparse data (zero values)</p>
            <BarSparkline data={SAMPLE_DATA_SPARSE} height={40} />
          </div>
          <div className="p-3 rounded-lg border border-border bg-card">
            <p className="text-xs text-muted-foreground mb-2">Larger (60px height)</p>
            <BarSparkline data={SAMPLE_DATA_UP} height={60} />
          </div>
        </div>
      </StateDemo>

      {/* Admin Sparklines (Recharts) */}
      <StateDemo label="Admin Sparkline (Recharts - with trend indicators)">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          <div className="p-3 rounded-lg border border-border bg-card">
            <p className="text-xs text-muted-foreground mb-2">Upward trend (green)</p>
            <AdminSparkline data={toAdminFormat(SAMPLE_DATA_UP)} height={40} width={120} />
          </div>
          <div className="p-3 rounded-lg border border-border bg-card">
            <p className="text-xs text-muted-foreground mb-2">Downward trend (red)</p>
            <AdminSparkline data={toAdminFormat(SAMPLE_DATA_DOWN)} height={40} width={120} />
          </div>
          <div className="p-3 rounded-lg border border-border bg-card">
            <p className="text-xs text-muted-foreground mb-2">Neutral trend (gray)</p>
            <AdminSparkline data={toAdminFormat(SAMPLE_DATA_NEUTRAL)} height={40} width={120} />
          </div>
        </div>
      </StateDemo>

      {/* Sparkline with Label */}
      <StateDemo label="Sparkline with Label (combined layout)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <div className="p-4 rounded-lg border border-border bg-card">
            <SparklineWithLabel
              label="Monthly Active Users"
              value="12,458"
              subtitle="+23% from last month"
              data={toAdminFormat(SAMPLE_DATA_UP)}
              icon={<Icon name="Users" size={16} />}
            />
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <SparklineWithLabel
              label="Revenue"
              value="$8,240"
              subtitle="-5% from last month"
              data={toAdminFormat(SAMPLE_DATA_DOWN)}
              icon={<Icon name="DollarSign" size={16} />}
            />
          </div>
        </div>
      </StateDemo>

      {/* Side-by-side comparison */}
      <StateDemo label="Implementation Comparison (same data, different components)">
        <div className="w-full space-y-4">
          <p className="text-xs text-muted-foreground">
            All three implementations rendering the same 12-point dataset. Note the different visual styles and features.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-border bg-card space-y-2">
              <p className="text-sm font-medium">SimpleSparkline</p>
              <p className="text-xs text-muted-foreground">Line with area fill, SVG-based</p>
              <SimpleSparkline data={SAMPLE_DATA_UP} height={50} />
            </div>
            <div className="p-4 rounded-lg border border-border bg-card space-y-2">
              <p className="text-sm font-medium">ui/Sparkline</p>
              <p className="text-xs text-muted-foreground">Bar chart, SVG-based</p>
              <BarSparkline data={SAMPLE_DATA_UP} height={50} />
            </div>
            <div className="p-4 rounded-lg border border-border bg-card space-y-2">
              <p className="text-sm font-medium">admin/Sparkline</p>
              <p className="text-xs text-muted-foreground">Bar chart, Recharts, trend dot</p>
              <AdminSparkline data={toAdminFormat(SAMPLE_DATA_UP)} height={50} width={200} />
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Usage notes */}
      <StateDemo label="Usage Recommendations">
        <div className="w-full text-sm text-muted-foreground space-y-2 p-4 rounded-lg border border-border bg-muted/30">
          <p><strong>SimpleSparkline</strong> - Best for activity/engagement trends, 24-hour data. Lightweight SVG.</p>
          <p><strong>ui/Sparkline</strong> - Best for discrete values, handles zero values well. Lightweight SVG.</p>
          <p><strong>admin/Sparkline</strong> - Best for admin dashboards with trend indicators. Uses Recharts (heavier).</p>
          <p className="pt-2 text-warning-foreground border-t border-border mt-2">
            <strong>Consolidation opportunity:</strong> Consider unifying the bar chart implementations (ui vs admin) to reduce bundle size.
          </p>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
