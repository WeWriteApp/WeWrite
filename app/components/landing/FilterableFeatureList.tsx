"use client";

import React, { useState, useEffect } from 'react';
import { PagePreviewCard } from './PagePreviewCard';
import { Button } from '../../components/ui/button';
import { Check, Clock, Wrench } from 'lucide-react';

interface Feature {
  title: string;
  description: string;
  status: 'done' | 'in-progress' | 'coming-soon';
  image?: string;
  pageId: string;
}

interface FilterableFeatureListProps {
  inProgressFeatures?: Feature[];
  comingSoonFeatures?: Feature[];
  availableFeatures?: Feature[];
  fadeInClass: string;
}

export function FilterableFeatureList({
  inProgressFeatures,
  comingSoonFeatures,
  availableFeatures,
  fadeInClass
}: FilterableFeatureListProps) {
  // Initialize filters from localStorage or default to all enabled
  const [filters, setFilters] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedFilters = localStorage.getItem('featureFilters');
      if (savedFilters) {
        return JSON.parse(savedFilters);
      }
    }
    return {
      inProgress: true,
      comingSoon: true,
      available: true
    };
  });

  // Save filters to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('featureFilters', JSON.stringify(filters));
    }
  }, [filters]);

  // Setup smooth scrolling for filter chips container on mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Get the filter chips container
    const filterChipsContainer = document.querySelector('.filter-chips-container');
    if (!filterChipsContainer) return;

    // Check if we're on mobile
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    // Simple mobile optimization - allow horizontal scrolling if needed
    const adjustContainerWidth = () => {
      const containerElement = filterChipsContainer as HTMLElement;

      // Enable horizontal scrolling on mobile if chips overflow
      containerElement.style.overflowX = 'auto';
      containerElement.style.scrollbarWidth = 'none'; // Firefox
      containerElement.style.msOverflowStyle = 'none'; // IE/Edge

      // Hide scrollbar for webkit browsers
      const style = document.createElement('style');
      style.textContent = `
        .filter-chips-container::-webkit-scrollbar {
          display: none;
        }
      `;
      document.head.appendChild(style);
    };

    // Call once on mount
    adjustContainerWidth();

    // Also adjust on resize
    window.addEventListener('resize', adjustContainerWidth);

    // Clean up event listeners
    return () => {
      window.removeEventListener('resize', adjustContainerWidth);
    };
  }, []);

  // Toggle a specific filter with logic to prevent all filters from being disabled
  const toggleFilter = (filterName: 'inProgress' | 'comingSoon' | 'available') => {
    setFilters(prev => {
      const newFilters = {
        ...prev,
        [filterName]: !prev[filterName]
      };

      // Check if all filters would be disabled
      const allDisabled = !newFilters.inProgress && !newFilters.comingSoon && !newFilters.available;

      // If all would be disabled, re-enable all filters instead
      if (allDisabled) {
        return {
          inProgress: true,
          comingSoon: true,
          available: true
        };
      }

      return newFilters;
    });
  };

  // Combine and filter features based on active filters and sort in the specified order:
  // 1. In Progress, 2. Coming Soon, 3. Available Now
  const filteredFeatures = [
    ...(filters.inProgress && Array.isArray(inProgressFeatures) ? inProgressFeatures : []),
    ...(filters.comingSoon && Array.isArray(comingSoonFeatures) ? comingSoonFeatures : []),
    ...(filters.available && Array.isArray(availableFeatures) ? availableFeatures : [])
  ];

  // Check if any filters are active
  const hasActiveFilters = filters.inProgress || filters.comingSoon || filters.available;

  return (
    <div className="w-full filter-chips-parent overflow-visible">
      {/* Filter controls */}
      <div className="mb-8 filter-chips-section overflow-visible">
        {/* Wrapping container for filter chips - center aligned with overflow visible for shadows */}
        <div className="filter-chips-container flex flex-wrap justify-center items-center gap-2 md:gap-3 px-4 sm:px-6 py-2 overflow-visible">
          {/* Direct container for chips without extra wrapping div */}
          <Button
            variant={filters.inProgress ? "default" : "outline"}
            size="sm"
            className={`filter-chip px-3 py-1.5 h-auto rounded-full transition-all duration-300 ease-in-out flex-shrink-0 text-xs ${
              filters.inProgress
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md'
                : 'text-amber-600 border-theme-medium hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30'
            }`}
            onClick={() => toggleFilter('inProgress')}
          >
            <span className="whitespace-nowrap">In Progress</span>
          </Button>

          <Button
            variant={filters.comingSoon ? "default" : "outline"}
            size="sm"
            className={`filter-chip px-3 py-1.5 h-auto rounded-full transition-all duration-300 ease-in-out flex-shrink-0 text-xs ${
              filters.comingSoon
                ? 'bg-gray-500 hover:bg-gray-600 text-white shadow-md'
                : 'text-muted-foreground border-theme-medium hover:bg-muted/50'
            }`}
            onClick={() => toggleFilter('comingSoon')}
          >
            <span className="whitespace-nowrap">Coming Soon</span>
          </Button>

          <Button
            variant={filters.available ? "default" : "outline"}
            size="sm"
            className={`filter-chip px-3 py-1.5 h-auto rounded-full transition-all duration-300 ease-in-out flex-shrink-0 text-xs ${
              filters.available
                ? 'bg-green-500 hover:bg-green-600 text-white shadow-md'
                : 'text-green-600 border-theme-medium hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30'
            }`}
            onClick={() => toggleFilter('available')}
          >
            <span className="whitespace-nowrap">Available Now</span>
          </Button>
        </div>
      </div>

      {/* Feature count */}
      {hasActiveFilters && (
        <div className="text-center mb-6 text-muted-foreground">
          <p>Showing {filteredFeatures.length} feature{filteredFeatures.length !== 1 ? 's' : ''}</p>
        </div>
      )}

      {/* Feature list with proper margins */}
      <div className="px-4 sm:px-6 md:px-8 lg:px-12">
        {hasActiveFilters ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFeatures.map((feature, index) => (
              <div
                key={feature.pageId}
                className={`${fadeInClass} transition-all duration-500 ease-spring transform-gpu`}
                style={{
                  animationDelay: `${index * 0.05}s`,
                  '--spring-duration': '0.5s',
                  '--spring-easing': 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              >
                <PagePreviewCard
                  title={feature.title}
                  content={feature.description || ""}
                  pageId={feature.pageId}
                  status={feature.status}
                  hideStatus={false}
                  maxContentLength={0}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground bg-gray-50 dark:bg-gray-900/30 rounded-lg">
            <p>No features selected. Please enable at least one filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}