"use client";

import React, { useState } from 'react';
import { Progress } from '../../components/ui/progress';
import { ComponentShowcase, StateDemo } from './shared';

export function ProgressSection({ id }: { id: string }) {
  const [animatedValue, setAnimatedValue] = useState(30);

  return (
    <ComponentShowcase
      id={id}
      title="Progress"
      path="app/components/ui/progress.tsx"
      description="Linear progress indicator built on Radix UI. Used for loading states, upload progress, quota usage, and other measurable values."
    >
      <StateDemo label="Values">
        <div className="w-full space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-8">0%</span>
            <Progress value={0} className="flex-1" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-8">25%</span>
            <Progress value={25} className="flex-1" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-8">50%</span>
            <Progress value={50} className="flex-1" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-8">75%</span>
            <Progress value={75} className="flex-1" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-8">100%</span>
            <Progress value={100} className="flex-1" />
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Custom Colors (via indicatorClassName)">
        <div className="w-full space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-16">Primary</span>
            <Progress value={60} className="flex-1" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-16">Success</span>
            <Progress value={80} className="flex-1" indicatorClassName="bg-green-500" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-16">Warning</span>
            <Progress value={45} className="flex-1" indicatorClassName="bg-orange-500" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-16">Error</span>
            <Progress value={90} className="flex-1" indicatorClassName="bg-red-500" />
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Sizes (via className)">
        <div className="w-full space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-12">Thin</span>
            <Progress value={65} className="flex-1 h-1" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-12">Small</span>
            <Progress value={65} className="flex-1 h-2" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-12">Default</span>
            <Progress value={65} className="flex-1" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-12">Large</span>
            <Progress value={65} className="flex-1 h-6" />
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Interactive">
        <div className="w-full space-y-3">
          <Progress value={animatedValue} className="w-full transition-all duration-300" />
          <div className="flex gap-2">
            <button
              className="px-3 py-1 text-sm rounded-md bg-secondary hover:bg-secondary/80"
              onClick={() => setAnimatedValue(Math.max(0, animatedValue - 10))}
            >
              -10%
            </button>
            <span className="text-sm text-muted-foreground self-center">{animatedValue}%</span>
            <button
              className="px-3 py-1 text-sm rounded-md bg-secondary hover:bg-secondary/80"
              onClick={() => setAnimatedValue(Math.min(100, animatedValue + 10))}
            >
              +10%
            </button>
          </div>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
