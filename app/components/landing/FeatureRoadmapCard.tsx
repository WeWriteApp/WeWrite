"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Wrench } from 'lucide-react';
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
      maxLines={8}
      className="shadow-lg h-full border-theme-medium"
      showAllocationBar={true}
      authorId="system"
      allocationSource="LandingPageCard"
    />
  );
}
