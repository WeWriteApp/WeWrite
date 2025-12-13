'use client';

import React, { useState } from 'react';
import { AllocationBarBase } from './components/payments/AllocationBarBase';
import { Slider } from './components/ui/slider';

/**
 * Circular Progress Pie Chart Component
 * Used to show progress toward a threshold (e.g., payout progress)
 */
function CircularProgress({
  percentage,
  size = 'md',
  label,
  sublabel
}: {
  percentage: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  sublabel?: string;
}) {
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

  const sizes = {
    sm: { svg: 16, stroke: 2.5 },
    md: { svg: 32, stroke: 3 },
    lg: { svg: 48, stroke: 4 }
  };

  const { svg: svgSize, stroke: strokeWidth } = sizes[size];
  const radius = (svgSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

  return (
    <div className="flex items-center gap-2">
      <svg width={svgSize} height={svgSize} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted-foreground/20"
        />
        {/* Progress circle */}
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="text-accent transition-all duration-300"
        />
      </svg>
      {(label || sublabel) && (
        <div className="flex flex-col">
          {label && <span className="text-sm font-medium">{label}</span>}
          {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}

export default function TestColors() {
  const [sliderValue, setSliderValue] = useState([50]);
  const [nativeSliderValue, setNativeSliderValue] = useState(50);

  React.useEffect(() => {
    // Debug CSS variables
    const root = document.documentElement;
    const warningVar = getComputedStyle(root).getPropertyValue('--warning');
    const warningBaseVar = getComputedStyle(root).getPropertyValue('--warning-base');
    const errorVar = getComputedStyle(root).getPropertyValue('--error');
    const neutralBaseVar = getComputedStyle(root).getPropertyValue('--neutral-base');
    const accentVar = getComputedStyle(root).getPropertyValue('--accent');

    document.getElementById('warning-var')!.textContent = warningVar || 'not set';
    document.getElementById('warning-base-var')!.textContent = warningBaseVar || 'not set';
    document.getElementById('error-var')!.textContent = errorVar || 'not set';
    document.getElementById('neutral-base-var')!.textContent = neutralBaseVar || 'not set';
    document.getElementById('accent-var')!.textContent = accentVar || 'not set';

    console.log('🎨 CSS Variables Debug:', {
      warning: warningVar,
      warningBase: warningBaseVar,
      error: errorVar,
      neutralBase: neutralBaseVar,
      accent: accentVar
    });
  }, []);

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Color System Test</h1>
      
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Neutral Colors</h2>
        <div className="flex gap-2">
          <div className="w-16 h-16 bg-neutral-10 border border-gray-300 flex items-center justify-center text-xs">10%</div>
          <div className="w-16 h-16 bg-neutral-20 border border-gray-300 flex items-center justify-center text-xs">20%</div>
          <div className="w-16 h-16 bg-neutral-30 border border-gray-300 flex items-center justify-center text-xs">30%</div>
          <div className="w-16 h-16 bg-neutral-40 border border-gray-300 flex items-center justify-center text-xs">40%</div>
          <div className="w-16 h-16 bg-neutral-50 border border-gray-300 flex items-center justify-center text-xs">50%</div>
          <div className="w-16 h-16 bg-neutral border border-gray-300 flex items-center justify-center text-xs">100%</div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Accent Colors</h2>
        <div className="flex gap-2">
          <div className="w-16 h-16 bg-accent-10 border border-gray-300 flex items-center justify-center text-xs">10%</div>
          <div className="w-16 h-16 bg-accent-20 border border-gray-300 flex items-center justify-center text-xs">20%</div>
          <div className="w-16 h-16 bg-accent-30 border border-gray-300 flex items-center justify-center text-xs">30%</div>
          <div className="w-16 h-16 bg-accent-40 border border-gray-300 flex items-center justify-center text-xs">40%</div>
          <div className="w-16 h-16 bg-accent-50 border border-gray-300 flex items-center justify-center text-xs">50%</div>
          <div className="w-16 h-16 bg-accent border border-gray-300 flex items-center justify-center text-xs">100%</div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Semantic Colors</h2>
        <div className="flex gap-2">
          <div className="w-16 h-16 bg-success border border-gray-300 flex items-center justify-center text-xs">Success</div>
          <div className="w-16 h-16 bg-warning border border-gray-300 flex items-center justify-center text-xs">Warning</div>
          <div className="w-16 h-16 bg-error border border-gray-300 flex items-center justify-center text-xs">Error</div>
        </div>
        <div className="text-sm space-y-1">
          <div>CSS Variables:</div>
          <div className="font-mono text-xs">
            --warning: <span id="warning-var">loading...</span>
          </div>
          <div className="font-mono text-xs">
            --warning-base: <span id="warning-base-var">loading...</span>
          </div>
          <div className="font-mono text-xs">
            --error: <span id="error-var">loading...</span>
          </div>
          <div className="font-mono text-xs">
            --neutral-base: <span id="neutral-base-var">loading...</span>
          </div>
          <div className="font-mono text-xs">
            --accent: <span id="accent-var">loading...</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Border Test</h2>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-secondary border-2 border-neutral-20 rounded">Border 20%</button>
          <button className="px-4 py-2 bg-secondary border-2 border-neutral-40 rounded">Border 40%</button>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Real Allocation Bar</h2>
        <div className="max-w-md">
          <AllocationBarBase
            pageId="test-page-id"
            authorId="test-author-id"
            pageTitle="Test Page"
            variant="default"
            source="test"
          />
        </div>
      </div>

      {/* Sliders Section */}
      <div className="space-y-4 border-t pt-4">
        <h2 className="text-lg font-semibold">Sliders</h2>

        {/* Radix UI Slider */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Radix UI Slider (shadcn)</h3>
          <div className="max-w-md space-y-2">
            <Slider
              value={sliderValue}
              onValueChange={setSliderValue}
              max={100}
              step={1}
            />
            <p className="text-xs text-muted-foreground">Value: {sliderValue[0]}</p>
          </div>
        </div>

        {/* Native HTML Slider (Fund Account style) */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Native Slider (Fund Account style)</h3>
          <div className="max-w-md space-y-2">
            <div className="relative">
              {/* Track background */}
              <div className="w-full h-2 bg-muted rounded-full relative overflow-hidden">
                {/* Filled portion */}
                <div
                  className="absolute top-0 left-0 h-full bg-accent rounded-full"
                  style={{ width: `${nativeSliderValue}%` }}
                />
              </div>
              {/* Invisible input on top */}
              <input
                type="range"
                min="0"
                max="100"
                value={nativeSliderValue}
                onChange={(e) => setNativeSliderValue(parseInt(e.target.value))}
                className="absolute top-0 left-0 w-full h-2 appearance-none cursor-pointer slider"
                style={{ background: 'transparent' }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
            <p className="text-xs text-muted-foreground">Value: {nativeSliderValue}%</p>
          </div>
        </div>

        {/* Slider variants */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Slider Variants</h3>
          <div className="max-w-md space-y-4">
            {/* Downgrade variant */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Downgrade (yellow)</p>
              <div className="relative">
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 rounded-full" style={{ width: '30%' }} />
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="30"
                  className="absolute top-0 left-0 w-full h-2 appearance-none cursor-pointer slider-downgrade"
                  style={{ background: 'transparent' }}
                />
              </div>
            </div>
            {/* Cancellation variant */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cancellation (red)</p>
              <div className="relative">
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: '70%' }} />
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="70"
                  className="absolute top-0 left-0 w-full h-2 appearance-none cursor-pointer slider-cancellation"
                  style={{ background: 'transparent' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Circular Progress / Pie Charts Section */}
      <div className="space-y-4 border-t pt-4">
        <h2 className="text-lg font-semibold">Circular Progress (Payout Progress)</h2>
        <p className="text-sm text-muted-foreground">
          These pie charts show progress toward a threshold, used in the floating financial header and settings earnings menu.
        </p>

        {/* Size variants */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Size Variants</h3>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <CircularProgress percentage={60} size="sm" />
              <span className="text-xs text-muted-foreground">Small (16px)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <CircularProgress percentage={60} size="md" />
              <span className="text-xs text-muted-foreground">Medium (32px)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <CircularProgress percentage={60} size="lg" />
              <span className="text-xs text-muted-foreground">Large (48px)</span>
            </div>
          </div>
        </div>

        {/* Fill states */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Fill States</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col items-center gap-1">
              <CircularProgress percentage={0} size="md" />
              <span className="text-xs text-muted-foreground">0%</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <CircularProgress percentage={10} size="md" />
              <span className="text-xs text-muted-foreground">10%</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <CircularProgress percentage={25} size="md" />
              <span className="text-xs text-muted-foreground">25%</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <CircularProgress percentage={50} size="md" />
              <span className="text-xs text-muted-foreground">50%</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <CircularProgress percentage={75} size="md" />
              <span className="text-xs text-muted-foreground">75%</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <CircularProgress percentage={90} size="md" />
              <span className="text-xs text-muted-foreground">90%</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <CircularProgress percentage={100} size="md" />
              <span className="text-xs text-muted-foreground">100%</span>
            </div>
          </div>
        </div>

        {/* With labels (settings menu style) */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">With Labels (Settings Menu Style)</h3>
          <div className="space-y-3">
            <CircularProgress percentage={20} size="sm" label="$20.00 to payout" />
            <CircularProgress percentage={60} size="sm" label="$10.00 to payout" />
            <CircularProgress percentage={92} size="sm" label="$2.00 to payout" />
          </div>
        </div>

        {/* Floating header style */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Large with Sublabel (Header Style)</h3>
          <div className="flex gap-6">
            <CircularProgress
              percentage={35}
              size="lg"
              label="$16.25 earned"
              sublabel="$8.75 to payout"
            />
            <CircularProgress
              percentage={80}
              size="lg"
              label="$20.00 earned"
              sublabel="$5.00 to payout"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
