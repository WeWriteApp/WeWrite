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
    <DynamicPagePreviewCard
      pageId="AXjA19RQnFLhIIfuncBb"
      customTitle="WeWrite Use Cases"
      buttonText="Explore use cases"
      maxLines={12}
      className="h-full"
      showAllocationBar={true}
      authorId="system"
      allocationSource="LandingPageCard"
    />
  );
}
