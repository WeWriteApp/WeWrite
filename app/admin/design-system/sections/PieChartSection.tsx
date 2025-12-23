"use client";

import React, { useState } from 'react';
import { PieChart, PieChartSegment } from '../../../components/ui/pie-chart';
import { ComponentShowcase, StateDemo } from './shared';

export function PieChartSection({ id }: { id: string }) {
  const [segment1Value, setSegment1Value] = useState(60);
  const [segment2Value, setSegment2Value] = useState(25);
  const [segment3Value, setSegment3Value] = useState(15);

  // Basic two-segment example (like allocation display)
  const allocationSegments: PieChartSegment[] = [
    {
      id: 'allocated',
      value: 7500,
      label: 'Allocated',
      color: 'stroke-primary',
      bgColor: 'bg-primary',
      textColor: 'text-primary',
    },
    {
      id: 'available',
      value: 2500,
      label: 'Available',
      color: 'stroke-green-500',
      bgColor: 'bg-green-500',
      textColor: 'text-green-500',
    },
  ];

  // Multi-segment interactive example
  const multiSegments: PieChartSegment[] = [
    {
      id: 'segment1',
      value: segment1Value,
      label: 'Category A',
      color: 'stroke-primary',
      bgColor: 'bg-primary',
      textColor: 'text-primary',
    },
    {
      id: 'segment2',
      value: segment2Value,
      label: 'Category B',
      color: 'stroke-blue-500',
      bgColor: 'bg-blue-500',
      textColor: 'text-blue-500',
    },
    {
      id: 'segment3',
      value: segment3Value,
      label: 'Category C',
      color: 'stroke-amber-500',
      bgColor: 'bg-amber-500',
      textColor: 'text-amber-500',
    },
  ];

  // Warning state example (nearly full)
  const warningSegments: PieChartSegment[] = [
    {
      id: 'used',
      value: 92,
      label: 'Used',
      color: 'stroke-yellow-500',
      bgColor: 'bg-yellow-500',
      textColor: 'text-yellow-500',
    },
    {
      id: 'remaining',
      value: 8,
      label: 'Remaining',
      color: 'stroke-green-500',
      bgColor: 'bg-green-500',
      textColor: 'text-green-500',
    },
  ];

  // Error state example (overspent)
  const errorSegments: PieChartSegment[] = [
    {
      id: 'spent',
      value: 120,
      label: 'Spent',
      color: 'stroke-red-500',
      bgColor: 'bg-red-500',
      textColor: 'text-red-500',
    },
    {
      id: 'budget',
      value: 0,
      label: 'Budget',
      color: 'stroke-muted-foreground',
      bgColor: 'bg-muted-foreground',
      textColor: 'text-muted-foreground',
    },
  ];

  return (
    <ComponentShowcase
      id={id}
      title="Pie Chart"
      path="app/components/ui/pie-chart.tsx"
      description="Interactive donut chart with legend. Supports hover/tap interactions, multiple segments, and customizable colors. Mobile-optimized with tap interactions."
    >
      <div className="space-y-8">
        {/* Allocation Example */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Allocation Display (Two Segments)</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Hover over segments or legend items to highlight. Used in /settings/spend page.
          </p>
          <div className="p-4 bg-muted/20 rounded-lg">
            <PieChart
              segments={allocationSegments}
              size={120}
              strokeWidth={16}
              showPercentage={true}
              centerLabel="allocated"
              formatValue={(value) => `$${(value / 100).toFixed(2)}`}
              showTotal={true}
              totalLabel="Monthly budget"
            />
          </div>
        </div>

        {/* Multi-Segment Interactive */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Multi-Segment (Interactive)</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Adjust values with sliders to see the chart update dynamically.
          </p>
          <div className="p-4 bg-muted/20 rounded-lg space-y-4">
            <PieChart
              segments={multiSegments}
              size={140}
              strokeWidth={20}
              showPercentage={true}
              centerLabel="of total"
              formatValue={(value) => `${value}%`}
            />
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center gap-3">
                <span className="text-sm w-24">Category A:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={segment1Value}
                  onChange={(e) => setSegment1Value(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">{segment1Value}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm w-24">Category B:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={segment2Value}
                  onChange={(e) => setSegment2Value(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">{segment2Value}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm w-24">Category C:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={segment3Value}
                  onChange={(e) => setSegment3Value(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">{segment3Value}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status States */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Status States</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-muted/20 rounded-lg">
              <p className="text-xs text-muted-foreground mb-3">Warning (Nearly Full - 92%)</p>
              <PieChart
                segments={warningSegments}
                size={100}
                strokeWidth={14}
                showPercentage={true}
                centerLabel="used"
                formatValue={(value) => `${value}%`}
              />
            </div>
            <div className="p-4 bg-muted/20 rounded-lg">
              <p className="text-xs text-muted-foreground mb-3">Error (Overspent - 120%)</p>
              <PieChart
                segments={errorSegments}
                size={100}
                strokeWidth={14}
                showPercentage={true}
                centerLabel="over budget"
                formatValue={(value) => `${value}%`}
              />
            </div>
          </div>
        </div>

        {/* Size Variations */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Size Variations</h4>
          <div className="flex flex-wrap gap-6 items-start">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">Small (80px)</p>
              <PieChart
                segments={allocationSegments}
                size={80}
                strokeWidth={10}
                showPercentage={true}
              />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">Medium (120px)</p>
              <PieChart
                segments={allocationSegments}
                size={120}
                strokeWidth={16}
                showPercentage={true}
              />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">Large (160px)</p>
              <PieChart
                segments={allocationSegments}
                size={160}
                strokeWidth={20}
                showPercentage={true}
              />
            </div>
          </div>
        </div>

        {/* Props Documentation */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Props</h4>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2 items-start flex-wrap">
              <code className="px-2 py-1 bg-muted rounded text-xs">segments: PieChartSegment[]</code>
              <span className="text-muted-foreground">- Array of segments with id, value, label, color classes</span>
            </div>
            <div className="flex gap-2 items-start flex-wrap">
              <code className="px-2 py-1 bg-muted rounded text-xs">size?: number</code>
              <span className="text-muted-foreground">- Chart diameter in pixels (default: 120)</span>
            </div>
            <div className="flex gap-2 items-start flex-wrap">
              <code className="px-2 py-1 bg-muted rounded text-xs">strokeWidth?: number</code>
              <span className="text-muted-foreground">- Thickness of the donut ring (default: 16)</span>
            </div>
            <div className="flex gap-2 items-start flex-wrap">
              <code className="px-2 py-1 bg-muted rounded text-xs">showPercentage?: boolean</code>
              <span className="text-muted-foreground">- Show percentage in center (default: true)</span>
            </div>
            <div className="flex gap-2 items-start flex-wrap">
              <code className="px-2 py-1 bg-muted rounded text-xs">centerLabel?: string</code>
              <span className="text-muted-foreground">- Label below percentage (default: 'allocated')</span>
            </div>
            <div className="flex gap-2 items-start flex-wrap">
              <code className="px-2 py-1 bg-muted rounded text-xs">formatValue?: (value: number) =&gt; string</code>
              <span className="text-muted-foreground">- Format function for legend values</span>
            </div>
            <div className="flex gap-2 items-start flex-wrap">
              <code className="px-2 py-1 bg-muted rounded text-xs">showTotal?: boolean</code>
              <span className="text-muted-foreground">- Show total row in legend (default: false)</span>
            </div>
            <div className="flex gap-2 items-start flex-wrap">
              <code className="px-2 py-1 bg-muted rounded text-xs">totalLabel?: string</code>
              <span className="text-muted-foreground">- Label for total row (default: 'Total')</span>
            </div>
          </div>
        </div>

        {/* Segment Interface */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">PieChartSegment Interface</h4>
          <div className="p-3 bg-muted/20 rounded-lg font-mono text-xs overflow-x-auto">
            <pre>{`interface PieChartSegment {
  id: string;           // Unique identifier
  value: number;        // Numeric value
  label: string;        // Display label
  color: string;        // Tailwind stroke class (e.g., 'stroke-primary')
  bgColor: string;      // Tailwind bg class for legend dot
  textColor?: string;   // Optional text color for value
}`}</pre>
          </div>
        </div>
      </div>
    </ComponentShowcase>
  );
}
