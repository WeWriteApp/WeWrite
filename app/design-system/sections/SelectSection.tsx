"use client";

import React, { useState } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../components/ui/select';
import { ComponentShowcase, StateDemo } from './shared';

export function SelectSection({ id }: { id: string }) {
  const [value, setValue] = useState('');

  return (
    <ComponentShowcase
      id={id}
      title="Select"
      path="app/components/ui/select.tsx"
      description="Custom dropdown select component for choosing from a list of options. Supports controlled and uncontrolled usage with animated item transitions."
    >
      <StateDemo label="Basic">
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Choose a theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
        {value && <span className="text-sm text-muted-foreground">Selected: {value}</span>}
      </StateDemo>

      <StateDemo label="With Default Value">
        <Select defaultValue="monthly">
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Billing cycle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </StateDemo>

      <StateDemo label="Full Width">
        <div className="w-full">
          <Select defaultValue="wrapped">
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Page list view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wrapped">Wrapped</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="detailed">Detailed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
