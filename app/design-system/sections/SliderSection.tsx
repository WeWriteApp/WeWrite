"use client";

import React, { useState } from 'react';
import { Slider } from '../../components/ui/slider';
import { ComponentShowcase, StateDemo } from './shared';

export function SliderSection({ id }: { id: string }) {
  const [value, setValue] = useState([50]);
  const [rangeValue, setRangeValue] = useState([25, 75]);

  return (
    <ComponentShowcase
      id={id}
      title="Slider"
      path="app/components/ui/slider.tsx"
      description="Range slider built on Radix UI for selecting numeric values. Supports single value and range selection with customizable min/max/step."
    >
      <StateDemo label="Basic">
        <div className="w-full space-y-3">
          <Slider
            value={value}
            onValueChange={setValue}
            max={100}
            step={1}
          />
          <span className="text-sm text-muted-foreground">Value: {value[0]}</span>
        </div>
      </StateDemo>

      <StateDemo label="With Steps">
        <div className="w-full space-y-3">
          <Slider
            defaultValue={[3]}
            max={10}
            step={1}
          />
          <span className="text-xs text-muted-foreground">Step: 1, Max: 10</span>
        </div>
      </StateDemo>

      <StateDemo label="Range (Two Thumbs)">
        <div className="w-full space-y-3">
          <Slider
            value={rangeValue}
            onValueChange={setRangeValue}
            max={100}
            step={5}
          />
          <span className="text-sm text-muted-foreground">Range: {rangeValue[0]} – {rangeValue[1]}</span>
        </div>
      </StateDemo>

      <StateDemo label="Disabled">
        <div className="w-full">
          <Slider defaultValue={[40]} max={100} disabled />
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
