"use client";

import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Feature card components
import ReplyFeatureCard from './features/ReplyFeatureCard';
import MapFeatureCard from './features/MapFeatureCard';
import GraphFeatureCard from './features/GraphFeatureCard';

interface FeatureConfig {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType;
}

const features: FeatureConfig[] = [
  {
    id: 'graph',
    title: 'Graph View',
    description: 'Visualize connections between pages and discover related content',
    component: GraphFeatureCard
  },
  {
    id: 'map',
    title: 'Map View',
    description: 'Add locations to your pages and explore content on a map',
    component: MapFeatureCard
  },
  {
    id: 'reply',
    title: 'Reply',
    description: 'Respond to any page with agree, disagree, or neutral replies',
    component: ReplyFeatureCard
  }
];

/**
 * FeaturesCarousel Component
 *
 * A sticky carousel showcasing WeWrite features with pagination dots.
 * Based on the leaderboard carousel implementation.
 */
export default function FeaturesCarousel() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const navigateFeature = useCallback((direction: 'next' | 'prev') => {
    let newIndex;
    if (direction === 'next') {
      newIndex = (selectedIndex + 1) % features.length;
    } else {
      newIndex = (selectedIndex - 1 + features.length) % features.length;
    }
    setSelectedIndex(newIndex);
  }, [selectedIndex]);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      navigateFeature('next');
    } else if (isRightSwipe) {
      navigateFeature('prev');
    }
  };

  // Card dimensions for centering
  const cardWidthPercent = 85;
  const gapPercent = 3;

  return (
    <section className="py-8 md:py-12">
      <div className="text-center mb-8 px-6">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Features</h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Discover the powerful tools that make WeWrite unique
        </p>
      </div>

      <div className="space-y-4">
        {/* Carousel container */}
        <div className="overflow-hidden px-4">
          <div
            ref={carouselRef}
            className="relative touch-pan-y"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Navigation Arrows - floating on sides of cards */}
            <button
              onClick={() => navigateFeature('prev')}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-background/90 backdrop-blur-sm border border-border shadow-md hover:bg-muted transition-colors"
              aria-label="Previous feature"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigateFeature('next')}
              className="absolute right-1 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-background/90 backdrop-blur-sm border border-border shadow-md hover:bg-muted transition-colors"
              aria-label="Next feature"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Cards Container - centered with visible neighbors */}
            <div
              className="flex transition-transform duration-300 ease-out"
              style={{
                transform: `translateX(calc(${(100 - cardWidthPercent) / 2}% - ${selectedIndex * (cardWidthPercent + gapPercent)}%))`,
              }}
            >
              {features.map((feature, index) => {
                const isActive = index === selectedIndex;
                const FeatureComponent = feature.component;

                return (
                  <div
                    key={feature.id}
                    className="flex-shrink-0"
                    style={{
                      width: `${cardWidthPercent}%`,
                      marginRight: `${gapPercent}%`,
                      opacity: isActive ? 1 : 0.5,
                      transform: isActive ? 'scale(1)' : 'scale(0.95)',
                      transition: 'opacity 0.3s ease, transform 0.3s ease'
                    }}
                  >
                    <Card className="wewrite-card overflow-hidden h-full">
                      <CardContent className="p-0">
                        {/* Feature header */}
                        <div className="px-4 py-3 bg-muted/30">
                          <h3 className="font-semibold text-base">{feature.title}</h3>
                          <p className="text-xs text-muted-foreground">{feature.description}</p>
                        </div>

                        {/* Feature preview */}
                        <div className="p-4">
                          <FeatureComponent />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pagination Dots */}
        <div className="flex justify-center gap-2.5">
          {features.map((feature, index) => (
            <button
              key={feature.id}
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-colors duration-200",
                index === selectedIndex
                  ? "bg-primary"
                  : "bg-neutral-30 hover:bg-neutral-40"
              )}
              aria-label={`Go to ${feature.title}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
