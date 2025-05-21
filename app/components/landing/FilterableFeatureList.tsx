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
  inProgressFeatures: Feature[];
  comingSoonFeatures: Feature[];
  availableFeatures: Feature[];
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

    // Ensure the container extends to the edges on mobile
    const adjustContainerWidth = () => {
      // Force the container to extend edge-to-edge
      const containerElement = filterChipsContainer as HTMLElement;

      // Get the viewport width
      const viewportWidth = window.innerWidth;

      // Get the container's offset from the left edge of the viewport
      const containerRect = containerElement.getBoundingClientRect();
      const containerOffsetLeft = containerRect.left;

      // Calculate the negative margin needed to extend to the left edge
      const negativeMarginLeft = containerOffsetLeft;

      // Apply the styles directly to ensure edge-to-edge layout
      containerElement.style.width = `${viewportWidth}px`;
      containerElement.style.marginLeft = `-${negativeMarginLeft}px`;
      containerElement.style.marginRight = `-${negativeMarginLeft}px`;
      containerElement.style.paddingLeft = `${negativeMarginLeft}px`;
      containerElement.style.paddingRight = '0';
      containerElement.style.boxSizing = 'border-box';
      containerElement.style.maxWidth = 'none';
      containerElement.style.position = 'relative';
      containerElement.style.left = '0';
      containerElement.style.right = '0';

      // Add a debug border to see the container boundaries
      // containerElement.style.border = '1px solid red';

      // Make sure all parent containers don't clip the content
      let parent = containerElement.parentElement;
      while (parent) {
        parent.style.overflow = 'visible';
        parent.style.position = 'relative';
        parent.style.maxWidth = '100%';
        parent.style.padding = '0';
        parent = parent.parentElement;
      }

      // Ensure the container is visible
      containerElement.style.opacity = '1';

      // Ensure the section container has the correct styles
      const featuresSection = document.getElementById('features');
      if (featuresSection) {
        const containers = featuresSection.querySelectorAll('.container');
        containers.forEach((container: HTMLElement) => {
          container.style.overflow = 'visible';
          container.style.maxWidth = '100%';
          container.style.padding = '0';
        });
      }

      // Ensure the filter chips section has the correct styles
      const filterChipsSection = document.querySelector('.filter-chips-section');
      if (filterChipsSection) {
        (filterChipsSection as HTMLElement).style.overflow = 'visible';
        (filterChipsSection as HTMLElement).style.position = 'relative';
        (filterChipsSection as HTMLElement).style.maxWidth = '100%';
        (filterChipsSection as HTMLElement).style.padding = '0';
        (filterChipsSection as HTMLElement).style.margin = '0';
      }
    };

    // Call once on mount
    adjustContainerWidth();

    // Also adjust on resize and after a short delay to ensure layout is complete
    window.addEventListener('resize', adjustContainerWidth);
    setTimeout(adjustContainerWidth, 100);
    setTimeout(adjustContainerWidth, 500); // Additional delay for safety

    // Add touch event listeners for better mobile scrolling experience
    let isScrolling = false;
    let startX: number;
    let scrollLeft: number;

    const startDrag = (e: TouchEvent | MouseEvent) => {
      isScrolling = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      startX = clientX;
      scrollLeft = (filterChipsContainer as HTMLElement).scrollLeft;

      // Add grabbing cursor
      (filterChipsContainer as HTMLElement).style.cursor = 'grabbing';
    };

    const endDrag = () => {
      isScrolling = false;
      // Reset cursor
      (filterChipsContainer as HTMLElement).style.cursor = 'grab';
    };

    const drag = (e: TouchEvent | MouseEvent) => {
      if (!isScrolling) return;

      // Don't prevent default to allow native scrolling behavior
      // This is important for iOS momentum scrolling

      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const x = clientX;
      const walk = (x - startX) * 1.5; // Scroll speed multiplier

      (filterChipsContainer as HTMLElement).scrollLeft = scrollLeft - walk;
    };

    // Add event listeners
    filterChipsContainer.addEventListener('touchstart', startDrag as EventListener);
    filterChipsContainer.addEventListener('touchend', endDrag);
    filterChipsContainer.addEventListener('touchmove', drag as EventListener);

    // Clean up event listeners
    return () => {
      filterChipsContainer.removeEventListener('touchstart', startDrag as EventListener);
      filterChipsContainer.removeEventListener('touchend', endDrag);
      filterChipsContainer.removeEventListener('touchmove', drag as EventListener);
      window.removeEventListener('resize', adjustContainerWidth);
    };
  }, []);

  // Toggle a specific filter
  const toggleFilter = (filterName: 'inProgress' | 'comingSoon' | 'available') => {
    setFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  // Combine and filter features based on active filters and sort in the specified order:
  // 1. In Progress, 2. Coming Soon, 3. Available Now
  const filteredFeatures = [
    ...(filters.inProgress ? inProgressFeatures : []),
    ...(filters.comingSoon ? comingSoonFeatures : []),
    ...(filters.available ? availableFeatures : [])
  ];

  // Check if any filters are active
  const hasActiveFilters = filters.inProgress || filters.comingSoon || filters.available;

  return (
    <div className="w-full filter-chips-parent">
      {/* Filter controls */}
      <div className="mb-8 filter-chips-section">
        {/* Horizontal scrollable container for mobile - edge to edge */}
        <div className="filter-chips-container flex md:flex-wrap md:justify-center gap-3 overflow-x-auto pb-2 scrollbar-hide md:scrollbar-thin md:scrollbar-thumb-gray-300 md:dark:scrollbar-thumb-gray-600 md:scrollbar-track-transparent scroll-smooth">
          {/* Direct container for chips without extra wrapping div */}
          <Button
            variant={filters.inProgress ? "default" : "outline"}
            size="sm"
            className={`filter-chip gap-2 px-4 py-2 h-auto rounded-full transition-all duration-300 ease-in-out flex-shrink-0 ${
              filters.inProgress
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md'
                : 'text-amber-600 border-amber-300 hover:bg-amber-100 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-900/30'
            }`}
            onClick={() => toggleFilter('inProgress')}
          >
            <Wrench className="h-4 w-4 flex-shrink-0" />
            <span className="whitespace-nowrap">In Progress</span>
            <span
              className={`filter-chip-checkmark ${
                filters.inProgress
                  ? 'w-3 opacity-100 ml-1'
                  : 'w-0 opacity-0 ml-0'
              }`}
            >
              <Check className="h-3 w-3 flex-shrink-0" />
            </span>
          </Button>

          <Button
            variant={filters.comingSoon ? "default" : "outline"}
            size="sm"
            className={`filter-chip gap-2 px-4 py-2 h-auto rounded-full transition-all duration-300 ease-in-out flex-shrink-0 ${
              filters.comingSoon
                ? 'bg-gray-500 hover:bg-gray-600 text-white shadow-md'
                : 'text-gray-600 border-gray-300 hover:bg-gray-100 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-900/30'
            }`}
            onClick={() => toggleFilter('comingSoon')}
          >
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span className="whitespace-nowrap">Coming Soon</span>
            <span
              className={`filter-chip-checkmark ${
                filters.comingSoon
                  ? 'w-3 opacity-100 ml-1'
                  : 'w-0 opacity-0 ml-0'
              }`}
            >
              <Check className="h-3 w-3 flex-shrink-0" />
            </span>
          </Button>

          <Button
            variant={filters.available ? "default" : "outline"}
            size="sm"
            className={`filter-chip gap-2 px-4 py-2 h-auto rounded-full transition-all duration-300 ease-in-out flex-shrink-0 ${
              filters.available
                ? 'bg-green-500 hover:bg-green-600 text-white shadow-md'
                : 'text-green-600 border-green-300 hover:bg-green-100 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/30'
            }`}
            onClick={() => toggleFilter('available')}
          >
            <Check className="h-4 w-4 flex-shrink-0" />
            <span className="whitespace-nowrap">Available Now</span>
            <span
              className={`filter-chip-checkmark ${
                filters.available
                  ? 'w-3 opacity-100 ml-1'
                  : 'w-0 opacity-0 ml-0'
              }`}
            >
              <Check className="h-3 w-3 flex-shrink-0" />
            </span>
          </Button>
          {/* Add an invisible spacer to ensure the last chip can be partially visible */}
          <div className="w-32 flex-shrink-0 md:hidden"></div>
        </div>
      </div>

      {/* Feature count */}
      {hasActiveFilters && (
        <div className="text-center mb-6 text-muted-foreground">
          <p>Showing {filteredFeatures.length} feature{filteredFeatures.length !== 1 ? 's' : ''}</p>
        </div>
      )}

      {/* Feature list */}
      {hasActiveFilters ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFeatures.map((feature, index) => (
            <div
              key={feature.pageId}
              className={`${fadeInClass}`}
              style={{ animationDelay: `${index * 0.05}s` }}
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
  );
}
