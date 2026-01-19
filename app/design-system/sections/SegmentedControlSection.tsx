"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { SegmentedControl, SegmentedControlList, SegmentedControlTrigger, SegmentedControlContent } from '../../components/ui/segmented-control';
import { ComponentShowcase, StateDemo } from './shared';

export function SegmentedControlSection({ id }: { id: string }) {
  const [activeSegment, setActiveSegment] = useState('segment1');

  return (
    <ComponentShowcase
      id={id}
      title="Segmented Control"
      path="app/components/ui/segmented-control.tsx"
      description="iOS-style segmented control with animated sliding background. Active segment slides smoothly using spring animation. Integrates with shiny style system when enabled."
    >
      <StateDemo label="Basic Segmented Control">
        <div className="w-full max-w-md">
          <SegmentedControl value={activeSegment} onValueChange={setActiveSegment}>
            <SegmentedControlList>
              <SegmentedControlTrigger value="segment1">Day</SegmentedControlTrigger>
              <SegmentedControlTrigger value="segment2">Week</SegmentedControlTrigger>
              <SegmentedControlTrigger value="segment3">Month</SegmentedControlTrigger>
            </SegmentedControlList>
            <SegmentedControlContent value="segment1">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Showing daily view data</p>
              </div>
            </SegmentedControlContent>
            <SegmentedControlContent value="segment2">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Showing weekly view data</p>
              </div>
            </SegmentedControlContent>
            <SegmentedControlContent value="segment3">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Showing monthly view data</p>
              </div>
            </SegmentedControlContent>
          </SegmentedControl>
        </div>
      </StateDemo>

      <StateDemo label="With Icons">
        <div className="w-full max-w-md">
          <SegmentedControl defaultValue="grid">
            <SegmentedControlList>
              <SegmentedControlTrigger value="list" className="flex items-center gap-1">
                <Icon name="Type" size={16} />
                <span className="hidden sm:inline">List</span>
              </SegmentedControlTrigger>
              <SegmentedControlTrigger value="grid" className="flex items-center gap-1">
                <Icon name="Palette" size={16} />
                <span className="hidden sm:inline">Grid</span>
              </SegmentedControlTrigger>
            </SegmentedControlList>
          </SegmentedControl>
        </div>
      </StateDemo>

      <StateDemo label="Two Options">
        <div className="w-full max-w-xs">
          <SegmentedControl defaultValue="active">
            <SegmentedControlList>
              <SegmentedControlTrigger value="active">Active</SegmentedControlTrigger>
              <SegmentedControlTrigger value="inactive">Inactive</SegmentedControlTrigger>
            </SegmentedControlList>
          </SegmentedControl>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
