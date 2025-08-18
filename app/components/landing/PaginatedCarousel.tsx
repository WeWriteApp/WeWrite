"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';

interface PaginatedCarouselProps {
  children: React.ReactNode[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showArrows?: boolean;
  showDots?: boolean;
  className?: string;
}

export default function PaginatedCarousel({
  children,
  autoPlay = true,
  autoPlayInterval = 5000,
  showArrows = true,
  showDots = true,
  className = ''
}: PaginatedCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const slideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const totalSlides = children.length;

  // Auto-play functionality with progress tracking
  useEffect(() => {
    if (!autoPlay || totalSlides <= 1 || isPaused) {
      // Clear existing intervals when paused
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (slideTimeoutRef.current) {
        clearTimeout(slideTimeoutRef.current);
        slideTimeoutRef.current = null;
      }
      return;
    }

    const startProgress = () => {
      setProgress(0);
      const progressStep = 100 / (autoPlayInterval / 50); // Update every 50ms

      progressIntervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            return 100;
          }
          return prev + progressStep;
        });
      }, 50);

      slideTimeoutRef.current = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % totalSlides);
        // Clear intervals before starting next cycle
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      }, autoPlayInterval);
    };

    startProgress();

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (slideTimeoutRef.current) {
        clearTimeout(slideTimeoutRef.current);
        slideTimeoutRef.current = null;
      }
    };
  }, [autoPlay, autoPlayInterval, totalSlides, currentIndex, isPaused]);

  // Handle pause/play toggle
  const handleCurrentSlideClick = () => {
    setIsPaused(!isPaused);
    setShowPlayPauseIcon(true);

    // Hide the icon after animation
    setTimeout(() => {
      setShowPlayPauseIcon(false);
    }, 1000);
  };

  const goToSlide = (index: number) => {
    if (index === currentIndex) {
      // Clicking current slide toggles pause/play
      handleCurrentSlideClick();
      return;
    }

    // Clear existing intervals when manually navigating
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (slideTimeoutRef.current) {
      clearTimeout(slideTimeoutRef.current);
      slideTimeoutRef.current = null;
    }

    setCurrentIndex(index);
    setProgress(0); // Reset progress when manually navigating
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  };





  return (
    <div className={`relative w-full ${className}`}>
      {/* Pagination numbers above cards - centered within container */}
      {showDots && totalSlides > 1 && (
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="flex justify-center mb-8 space-x-4">
            {children.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`relative w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-200 ${
                  index === currentIndex
                    ? 'bg-primary text-primary-foreground scale-110'
                    : 'border-2 border-muted-foreground/30 text-muted-foreground/70 hover:border-muted-foreground/50 hover:text-muted-foreground/90'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              >
                {/* Countdown pie chart for current slide */}
                {index === currentIndex && autoPlay && totalSlides > 1 && !isPaused && (
                  <svg
                    className="absolute inset-0 w-12 h-12 -rotate-90"
                    viewBox="0 0 48 48"
                  >
                    <circle
                      cx="24"
                      cy="24"
                      r="22"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeOpacity="0.3"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="22"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray={`${2 * Math.PI * 22}`}
                      strokeDashoffset={`${2 * Math.PI * 22 * (1 - progress / 100)}`}
                      className="transition-all duration-75 ease-linear"
                    />
                  </svg>
                )}

                {/* Play/Pause icon animation */}
                {index === currentIndex && showPlayPauseIcon && (
                  <div className="absolute inset-0 flex items-center justify-center text-white z-20 animate-pulse">
                    {isPaused ? (
                      <Play className="h-6 w-6 fill-current" />
                    ) : (
                      <Pause className="h-6 w-6 fill-current" />
                    )}
                  </div>
                )}

                <span className={`relative z-10 transition-opacity duration-200 ${
                  index === currentIndex && showPlayPauseIcon ? 'opacity-0' : 'opacity-100'
                }`}>
                  {index + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile: Centered active card with peek | Desktop: All cards stacked */}
      <div className="relative">
        {/* Mobile carousel - cards with peek overflow */}
        <div className="block lg:hidden overflow-visible">
          <div
            className="flex gap-4 transition-transform duration-500 ease-out"
            style={{
              transform: `translateX(calc(50vw - 50% - ${currentIndex * (85 + 4)}vw))`, // Center active card
            }}
          >
            {children.map((child, index) => (
              <div
                key={index}
                className="flex-shrink-0"
                style={{ width: '85vw', maxWidth: '400px' }}
              >
                {child}
              </div>
            ))}
          </div>
        </div>

        {/* Desktop stack - all cards visible, centered */}
        <div className="hidden lg:flex justify-center items-center gap-6">
          {children.map((child, index) => {
            const isActive = index === currentIndex;

            return (
              <div
                key={index}
                className="transition-all duration-500 ease-out cursor-pointer"
                style={{
                  width: '80%',
                  maxWidth: '500px',
                  opacity: isActive ? 1 : 0.4,
                  transform: isActive ? 'scale(1)' : 'scale(0.95)',
                }}
                onClick={() => goToSlide(index)}
              >
                {child}
              </div>
            );
          })}
        </div>
      </div>


    </div>
  );
}
