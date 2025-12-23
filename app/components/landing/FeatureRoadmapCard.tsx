"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Icon } from '@/components/ui/Icon';
import DynamicPagePreviewCard from './DynamicPagePreviewCard';

interface FeatureRoadmapCardProps {
  fadeInClass?: string;
}

export default function FeatureRoadmapCard({ fadeInClass = '' }: FeatureRoadmapCardProps) {
  return (
    <DynamicPagePreviewCard
      pageId="zRNwhNgIEfLFo050nyAT"
      customTitle="WeWrite Feature Roadmap"
      buttonText="Read full roadmap"
      maxLines={12}
      className="h-full"
      showAllocationBar={true}
      authorId="system"
      allocationSource="LandingPageCard"
      // Landing page: use $0.10 interval, disable modal and long-press
      allocationIntervalCents={10}
      disableAllocationModal={true}
      disableAllocationLongPress={true}
    />
  );
}
