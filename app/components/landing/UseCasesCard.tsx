"use client";

import React from 'react';
import UnifiedPagePreviewCard from './UnifiedPagePreviewCard';

interface UseCasesCardProps {
  fadeInClass?: string;
}

export default function UseCasesCard({ fadeInClass = '' }: UseCasesCardProps) {
  return (
    <UnifiedPagePreviewCard
      pageId="AXjA19RQnFLhIIfuncBb"
      title="WeWrite Use Cases"
      buttonText="Read more..."
      maxLines={8}
      className="shadow-lg h-full border-theme-medium"
      showAllocationBar={true}
      authorId="demo-author"
      allocationSource="LandingPageCard"
    />
  );
}
