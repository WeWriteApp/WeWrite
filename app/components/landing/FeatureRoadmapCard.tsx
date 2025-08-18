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
    <Card className="h-full border-theme-medium bg-gradient-to-br from-background via-background to-blue-50/20 dark:to-blue-950/20">
      <CardHeader className="text-center pb-6">
        <CardTitle className="text-3xl md:text-4xl font-bold flex items-center justify-center gap-3">
          <Wrench className="h-8 w-8" />
          Feature Roadmap
        </CardTitle>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Discover what makes WeWrite special and what's coming next.
        </p>
      </CardHeader>
      
      <CardContent className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <DynamicPagePreviewCard
            pageId="zRNwhNgIEfLFo050nyAT"
            customTitle="WeWrite Feature Roadmap"
            buttonText="Read full roadmap"
            maxLines={5}
            className="shadow-lg h-full"
          />
        </div>
      </CardContent>
    </Card>
  );
}
