"use client";

import React, { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { useSwipeable } from 'react-swipeable';
import { AnimatePresence, motion } from 'framer-motion';
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { ANALYTICS_EVENTS } from '../../constants/analytics-events';

// Carousel images for hero section
const heroImages = [
  '/images/landing/LP-01.png',
  '/images/landing/LP-02.png',
  '/images/landing/LP-03.png',
  '/images/landing/LP-04.png',
  '/images/landing/LP-05.png',
];

interface HeroSectionProps {
  fadeInClass: string;
  platformOptions: string[];
  platformIndex: number;
  isAnimatingPlatform: boolean;
  handlePlatformClick: () => void;
  platformRef: React.RefObject<HTMLSpanElement>;
}

export default function HeroSection({
  fadeInClass,
  platformOptions,
  platformIndex,
  isAnimatingPlatform,
  handlePlatformClick,
  platformRef
}: HeroSectionProps) {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const heroSectionRef = useRef<HTMLElement>(null);
  const analytics = useWeWriteAnalytics();

  // Memoize the rotation handler to prevent unnecessary re-renders
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Throttle the mouse move handler to reduce re-renders
    // Only update rotation every 50ms to prevent excessive re-renders
    if (!heroSectionRef.current || (window as any).isThrottlingHeroMove) return;

    (window as any).isThrottlingHeroMove = true;
    setTimeout(() => {
      (window as any).isThrottlingHeroMove = false;
    }, 50);

    const rect = heroSectionRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate rotation (limited to ±5 degrees)
    const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * 5;
    const rotateX = -((e.clientY - centerY) / (rect.height / 2)) * 5;

    setRotation({ x: rotateX, y: rotateY });
  }, []);

  // Helper for changing index with direction
  const goToIndex = useCallback((newIdx: number) => {
    setSlideDirection(newIdx > carouselIndex || (newIdx === 0 && carouselIndex === heroImages.length - 1) ? 'right' : 'left');
    setCarouselIndex(newIdx);
  }, [carouselIndex]);

  // Swipe handlers for carousel
  const handlers = useSwipeable({
    onSwipedLeft: () => goToIndex((carouselIndex + 1) % heroImages.length),
    onSwipedRight: () => goToIndex((carouselIndex - 1 + heroImages.length) % heroImages.length),
    trackMouse: true,
    trackTouch: true,
    preventDefaultTouchmoveEvent: true,
  });

  return (
    <section
      className="py-16 md:py-20 relative overflow-hidden"
      ref={heroSectionRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setRotation({ x: 0, y: 0 })}
    >
      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div
            className={`flex-1 text-center lg:text-left ${fadeInClass}`}
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Write, share, earn.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              WeWrite is a free speech platform and social wiki where every page is a <span
                className="cursor-pointer relative group"
                onClick={(e) => {
                  e.preventDefault();
                  // Track fundraiser text click in Google Analytics
                  analytics.trackInteractionEvent(ANALYTICS_EVENTS.LINK_CLICKED, {
                    label: 'Fundraiser text click: scroll to features',
                    link_type: 'text',
                    link_text: 'fundraiser',
                    link_url: '#features'
                  });
                  const targetElement = document.getElementById('features');
                  if (targetElement) {
                    const headerHeight = window.innerWidth >= 768 ? 60 : 100;
                    const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - headerHeight;
                    window.scrollTo({ top: targetPosition, behavior: 'smooth' });
                  }
                }}
              >
                fundraiser
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 text-xs bg-black/80 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                  Coming soon
                </span>
              </span>. Write a hundred pages, you've just written a hundred <span
                ref={platformRef}
                onClick={handlePlatformClick}
                className="cursor-pointer hover:text-primary transition-colors select-none"
                title="Click me!"
              >
                {platformOptions[platformIndex]}
              </span>.
            </p>
            <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4">
              <Button
                size="lg"
                variant="outline"
                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
                asChild
              >
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
                <Link href="/auth/register">Create Account</Link>
              </Button>
            </div>
          </div>

          <div className={`flex-1 perspective-[1000px] ${fadeInClass}`} style={{ animationDelay: '0.2s' }}>
            <div
              className="relative w-full max-w-lg mx-auto transform-gpu transition-transform duration-300"
              style={{
                transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
                transformStyle: 'preserve-3d'
              }}
            >
              <div {...handlers} className="relative w-full h-full">
                <div className="relative w-full h-full min-h-[420px] flex items-center justify-center">
                  <AnimatePresence initial={false} custom={slideDirection} mode="wait">
                    <motion.div
                      key={carouselIndex}
                      initial={{ x: slideDirection === 'right' ? 300 : -300, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: slideDirection === 'right' ? -300 : 300, opacity: 0 }}
                      transition={{ x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                      className="group relative block focus:outline-none w-full bg-none border-none p-0"
                      onClick={() => setLightboxOpen(true)}
                      aria-label="Open image lightbox"
                      role="button"
                      tabIndex={0}
                      style={{ position: 'relative', width: '100%', height: '420px' }}
                    >
                      <div className="relative w-full h-full">
                        <Image
                          key={carouselIndex}
                          src={heroImages[carouselIndex]}
                          alt={`WeWrite App Interface ${carouselIndex + 1}`}
                          fill
                          className={`rounded-lg shadow-2xl cursor-pointer transition-transform duration-300 group-hover:scale-105 object-cover`}
                          priority
                          loading="eager"
                          sizes="(max-width: 768px) 100vw, 700px"
                        />
                      </div>
                      {/* Left arrow */}
                      <button
                        type="button"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-2 shadow hover:bg-background/90 z-10"
                        onClick={e => { e.stopPropagation(); goToIndex((carouselIndex - 1 + heroImages.length) % heroImages.length); }}
                        aria-label="Previous image"
                      >
                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      {/* Right arrow */}
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-2 shadow hover:bg-background/90 z-10"
                        onClick={e => { e.stopPropagation(); goToIndex((carouselIndex + 1) % heroImages.length); }}
                        aria-label="Next image"
                      >
                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </motion.div>
                  </AnimatePresence>
                </div>
                {/* Filmstrip */}
                <div className="flex justify-center gap-2 mt-4">
                  {heroImages.map((img, idx) => (
                    <button
                      key={img}
                      className={`rounded-md ${carouselIndex === idx ? 'ring-2 ring-primary' : 'ring-1 ring-border/30'} focus:outline-none transition-transform duration-200 overflow-hidden`}
                      style={{ width: 56, height: 40, background: 'none', padding: 0, transform: carouselIndex === idx ? 'scale(1.08)' : undefined }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                      onMouseLeave={e => e.currentTarget.style.transform = carouselIndex === idx ? 'scale(1.08)' : 'scale(1)'}
                      onClick={() => goToIndex(idx)}
                      aria-label={`Show image ${idx + 1}`}
                    >
                      <Image src={img} alt={`Thumbnail ${idx + 1}`} width={56} height={40} className="object-cover w-full h-full transition-transform duration-200" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox overlay */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 animate-fadeInFast"
          style={{ animation: 'fadeIn 0.2s' }}
          onClick={() => setLightboxOpen(false)} // Close lightbox when clicking the overlay
        >
          {/* Close button */}
          <button
            className="absolute top-6 right-8 z-50 bg-white/80 hover:bg-white rounded-full p-2 shadow"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(false);
            }}
            aria-label="Close lightbox"
            type="button"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Navigation buttons */}
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 bg-white/80 hover:bg-white rounded-full p-2 shadow"
            onClick={(e) => {
              e.stopPropagation();
              goToIndex((carouselIndex - 1 + heroImages.length) % heroImages.length);
            }}
            aria-label="Previous image"
            type="button"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 bg-white/80 hover:bg-white rounded-full p-2 shadow"
            onClick={(e) => {
              e.stopPropagation();
              goToIndex((carouselIndex + 1) % heroImages.length);
            }}
            aria-label="Next image"
            type="button"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Main image */}
          <div
            className="flex-1 flex items-center justify-center w-full max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={heroImages[carouselIndex]}
              alt={`WeWrite App Interface ${carouselIndex + 1}`}
              width={900}
              height={900}
              className="rounded-lg shadow-2xl max-h-[80vh] object-contain"
              priority
            />
          </div>

          {/* Filmstrip in lightbox */}
          <div className="flex justify-center gap-3 mt-8 mb-8">
            {heroImages.map((img, idx) => (
              <button
                key={img}
                className={`rounded-md ${carouselIndex === idx ? 'ring-2 ring-primary' : 'ring-1 ring-border/30'} focus:outline-none transition-transform duration-200 overflow-hidden`}
                style={{ width: 80, height: 60, background: 'none', padding: 0, transform: carouselIndex === idx ? 'scale(1.08)' : undefined }}
                onClick={(e) => {
                  e.stopPropagation();
                  goToIndex(idx);
                }}
                aria-label={`Show image ${idx + 1}`}
              >
                <Image
                  src={img}
                  alt={`Thumbnail ${idx + 1}`}
                  width={80}
                  height={60}
                  className="object-cover w-full h-full transition-transform duration-200"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
