"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Heart } from 'lucide-react';
import DynamicPagePreviewCard from './DynamicPagePreviewCard';

interface UseCasesCardProps {
  fadeInClass?: string;
}

export default function UseCasesCard({ fadeInClass = '' }: UseCasesCardProps) {
  return (
    <Card className="h-full border-theme-medium bg-gradient-to-br from-background via-background to-pink-50/20 dark:to-pink-950/20">
      <CardHeader className="text-center pb-6">
        <CardTitle className="text-3xl md:text-4xl font-bold flex items-center justify-center gap-3">
          <Heart className="h-8 w-8" />
          Use Cases
        </CardTitle>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          See how writers, teams, and creators are using WeWrite to build amazing content.
        </p>
      </CardHeader>
      
      <CardContent className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <DynamicPagePreviewCard
            pageId="AXjA19RQnFLhIIfuncBb"
            customTitle="WeWrite Use Cases"
            buttonText="Explore use cases"
            maxLines={5}
            className="shadow-lg h-full"
          />
        </div>
      </CardContent>
    </Card>
  );
}
