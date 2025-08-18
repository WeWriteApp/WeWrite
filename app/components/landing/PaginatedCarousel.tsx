"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [direction, setDirection] = useState(0);

  const totalSlides = children.length;

  // Auto-play functionality
  useEffect(() => {
    if (!autoPlay || totalSlides <= 1) return;

    const interval = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % totalSlides);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, totalSlides]);

  const goToSlide = (index: number) => {
    if (index === currentIndex) return;
    
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const goToNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  return (
    <div className={`relative w-full ${className}`}>
      {/* Pagination numbers above cards */}
      {showDots && totalSlides > 1 && (
        <div className="flex justify-center mb-8 space-x-4">
          {children.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`text-2xl font-bold transition-all duration-200 ${
                index === currentIndex
                  ? 'text-primary scale-110'
                  : 'text-muted-foreground/50 hover:text-muted-foreground/80'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}

      {/* Main carousel container */}
      <div className="relative overflow-hidden">
        {/* Peek cards on sides */}
        <div className="flex items-center justify-center relative overflow-visible">
          {/* Previous card peek */}
          {totalSlides > 1 && (
            <div className="hidden md:block w-32 opacity-50 transform scale-90 -mr-16 z-0 cursor-pointer" onClick={goToPrevious}>
              <div className="pointer-events-none">
                {children[(currentIndex - 1 + totalSlides) % totalSlides]}
              </div>
            </div>
          )}

          {/* Current card */}
          <div className="flex-1 max-w-4xl mx-auto relative z-10">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
                className="w-full"
              >
                {children[currentIndex]}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Next card peek */}
          {totalSlides > 1 && (
            <div className="hidden md:block w-32 opacity-50 transform scale-90 -ml-16 z-0 cursor-pointer" onClick={goToNext}>
              <div className="pointer-events-none">
                {children[(currentIndex + 1) % totalSlides]}
              </div>
            </div>
          )}
        </div>


      </div>


    </div>
  );
}
