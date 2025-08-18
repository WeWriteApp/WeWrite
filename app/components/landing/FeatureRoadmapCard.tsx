"use client";

import React from 'react';
import UnifiedPagePreviewCard from './UnifiedPagePreviewCard';

interface FeatureRoadmapCardProps {
  fadeInClass?: string;
}

export default function FeatureRoadmapCard({ fadeInClass = '' }: FeatureRoadmapCardProps) {
  return (
    <UnifiedPagePreviewCard
      pageId="zRNwhNgIEfLFo050nyAT"
      title="WeWrite Feature Roadmap"
      buttonText="Read more..."
      maxLines={8}
      className="shadow-lg h-full border-theme-medium"
      showAllocationBar={true}
      authorId="demo-author"
      allocationSource="LandingPageCard"
    />
  );
}
