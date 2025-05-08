"use client";

import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '../../components/ui/button';
import { Check, ArrowRight, Flame, Loader, User } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Separator } from "../../components/ui/separator";
import Header from '../Header';
import { PagePreviewCard } from './PagePreviewCard';
import { useTheme } from "next-themes";
import { PillLink } from "../PillLink";
import { useSwipeable } from 'react-swipeable';
import { AnimatePresence, motion } from 'framer-motion';
import { getPageById } from '../../firebase/database';
import ActivityCarousel from './ActivityCarousel';
import TrendingCarousel from './TrendingCarousel';

// Carousel images for hero section
const heroImages = [
  '/images/landing/LP-01.png',
  '/images/landing/LP-02.png',
  '/images/landing/LP-03.png',
  '/images/landing/LP-04.png',
  '/images/landing/LP-05.png',
];

// Simple fade-in animation using CSS
const fadeInClass = "animate-fadeIn";

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const heroSectionRef = useRef<HTMLElement>(null);
  const { setTheme, theme } = useTheme();
  const [pageContents, setPageContents] = useState<Record<string, any>>({});

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // We'll use a simpler approach for the 3D effect using React state instead of DOM manipulation

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Always set accent color to blue on landing page mount
  useEffect(() => {
    // Remove any accent color class from body or html
    document.body.classList.remove('accent-red', 'accent-green', 'accent-yellow', 'accent-purple', 'accent-pink', 'accent-orange');
    document.documentElement.classList.remove('accent-red', 'accent-green', 'accent-yellow', 'accent-purple', 'accent-pink', 'accent-orange');
    // Add blue accent color
    document.body.classList.add('accent-blue');
    document.documentElement.classList.add('accent-blue');
    // Force blue accent color variables for landing page
    document.documentElement.style.setProperty('--accent-h', '217');
    document.documentElement.style.setProperty('--accent-s', '91%');
    document.documentElement.style.setProperty('--accent-l', '60%');
    document.documentElement.style.setProperty('--accent', '#2563eb'); // Tailwind blue-600
    // Don't force theme - respect user's system preference
    // if (setTheme) setTheme('light');
  }, [setTheme]);

  // Fetch page content for feature roadmap cards
  useEffect(() => {
    const fetchPageContents = async () => {
      // Page IDs to fetch
      const pageIds = [
        'RFsPq1tbcOMtljwHyIMT', // Every Page is a Fundraiser
        'aJFMqTEKuNEHvOrYE9c2', // No ads
        'ou1LPmpynpoirLrv99fq', // Multiple view modes
        'o71h6Lg1wjGSC1pYaKXz', // Recurring donations
        '4jw8FdMJHGofMc4G2QTw', // Collaborative pages
        'N7Pg3iJ0OQhkpw16MTZW', // Map view
        '0krXqAU748w43YnWJwE2'  // Calendar view
      ];

      const contents: Record<string, any> = {};

      for (const pageId of pageIds) {
        try {
          const { pageData, versionData } = await getPageById(pageId);

          if (pageData && versionData) {
            // Parse content from version data
            let body = '';
            try {
              const contentObj = JSON.parse(versionData.content);
              // Extract text content from nodes
              body = contentObj.map((node: any) => {
                if (node.type === 'paragraph' && node.children) {
                  return node.children.map((child: any) => child.text || '').join('');
                }
                return '';
              }).join('\n\n');
            } catch (err) {
              console.error(`Error parsing content for page ${pageId}:`, err);
            }

            contents[pageId] = {
              title: pageData.title || 'Untitled',
              body: body || pageData.body || '',
              isPublic: pageData.isPublic || false
            };
          }
        } catch (err) {
          console.error(`Error fetching page ${pageId}:`, err);
          // Provide fallback content
          contents[pageId] = {
            title: 'Error loading page',
            body: 'Content could not be loaded.',
            isPublic: false
          };
        }
      }

      setPageContents(contents);
    };

    fetchPageContents();
  }, []);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') setCarouselIndex((i) => (i + 1) % heroImages.length);
      if (e.key === 'ArrowLeft') setCarouselIndex((i) => (i - 1 + heroImages.length) % heroImages.length);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxOpen]);

  // Smooth scroll function for anchor links
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const targetId = href.replace('#', '');
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
      // Adjust header height based on screen size
      const headerHeight = window.innerWidth >= 768 ? 60 : 100; // Desktop: 60px, Mobile: 100px (includes both header rows)
      const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - headerHeight;
      window.scrollTo({ top: targetPosition, behavior: 'smooth' });
      window.history.pushState(null, '', href);
    }
  };

  // Features data
  const builtFeatures = [
    {
      title: "Every Page is a Fundraiser",
      description: "On every page, there's a Pledge bar floating at the bottom. Users set their Budget (subscription) and donate to their favorite pages.",
      status: "in-progress",
      image: "/images/feature-fundraiser.png",
      pageId: "RFsPq1tbcOMtljwHyIMT"
    },
    {
      title: "No ads",
      description: "Since each page on WeWrite is a fundraiser, we won't need to sell ad space to companies.",
      status: "done",
      image: "/images/feature-no-ads.png",
      pageId: "aJFMqTEKuNEHvOrYE9c2"
    },
    {
      title: "Multiple View Modes",
      description: "Choose between Wrapped, Default, and Spaced reading modes to customize your reading experience.",
      status: "done",
      image: "/images/feature-1.png",
      pageId: "ou1LPmpynpoirLrv99fq"
    }
  ];

  const comingSoonFeatures = [
    {
      title: "Recurring donations",
      description: "Support your favorite writers with monthly donations that help them continue creating great content.",
      status: "coming-soon",
      image: "/images/feature-donations.png",
      pageId: "o71h6Lg1wjGSC1pYaKXz"
    },
    {
      title: "Collaborative pages",
      description: "Work together with others on shared documents with real-time collaboration features.",
      status: "coming-soon",
      image: "/images/feature-collaboration.png",
      pageId: "4jw8FdMJHGofMc4G2QTw"
    },
    {
      title: "Map view",
      description: "Visualize your content and connections in an interactive map interface.",
      status: "coming-soon",
      image: "/images/feature-map-view.png",
      pageId: "N7Pg3iJ0OQhkpw16MTZW"
    },
    {
      title: "Calendar view",
      description: "Organize and view your content in a calendar interface.",
      status: "coming-soon",
      image: "/images/feature-calendar.png",
      pageId: "0krXqAU748w43YnWJwE2"
    }
  ];

  // Tech stack data
  const techStack = [
    {
      title: "Next.js & TypeScript",
      description: "Built with Next.js 14 and TypeScript for type-safe, performant web applications."
    },
    {
      title: "Firebase Backend",
      description: "Powered by Firebase for authentication, real-time database, and secure storage."
    },
    {
      title: "Modern UI Libraries",
      description: "Using Shadcn UI, Radix, and NextUI components for a beautiful, accessible interface."
    }
  ];

  // Helper function to render status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
        return <Badge variant="default" className="bg-green-500">Available Now</Badge>;
      case 'in-progress':
        return <Badge variant="secondary" className="bg-amber-500 text-white">In Progress</Badge>;
      case 'coming-soon':
        return <Badge variant="outline">Coming Soon</Badge>;
      default:
        return null;
    }
  };

  // Helper for changing index with direction
  const goToIndex = (newIdx: number) => {
    setSlideDirection(newIdx > carouselIndex || (newIdx === 0 && carouselIndex === heroImages.length - 1) ? 'right' : 'left');
    setCarouselIndex(newIdx);
  };

  // Swipe handlers for carousel
  const handlers = useSwipeable({
    onSwipedLeft: () => goToIndex((carouselIndex + 1) % heroImages.length),
    onSwipedRight: () => goToIndex((carouselIndex - 1 + heroImages.length) % heroImages.length),
    trackMouse: true,
    trackTouch: true,
    preventDefaultTouchmoveEvent: true,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Navigation - Always sticky at the top */}
      <header className="sticky top-0 left-0 right-0 w-full z-50 transition-all duration-200 hidden md:block bg-background/90 backdrop-blur-xl shadow-md py-3">
        <div className="container mx-auto flex justify-between items-center px-6">
          <div className="flex items-center space-x-6">
            <h1
              className="text-2xl font-bold cursor-pointer dark:text-white text-primary"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              WeWrite
            </h1>

            <nav className="hidden md:flex space-x-6">
              <a
                href="#activity"
                onClick={(e) => scrollToSection(e, '#activity')}
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Recent Activity
              </a>
              <a
                href="#trending"
                onClick={(e) => scrollToSection(e, '#trending')}
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Trending
              </a>
              <a
                href="#features"
                onClick={(e) => scrollToSection(e, '#features')}
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Features
              </a>
              <a
                href="#supporters"
                onClick={(e) => scrollToSection(e, '#supporters')}
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Supporters
              </a>
              <a
                href="#about"
                onClick={(e) => scrollToSection(e, '#about')}
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                About
              </a>
              <a
                href="#get-started"
                onClick={(e) => scrollToSection(e, '#get-started')}
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Get Started
              </a>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <Button variant="secondary" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
              <Link href="/auth/register">Create Account</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation - Always sticky at the top */}
      <div className="md:hidden sticky top-0 left-0 right-0 z-50 flex flex-col w-full">
        {/* Title and buttons */}
        <div className="w-full bg-background/90 backdrop-blur-xl shadow-sm py-2">
          <div className="container mx-auto flex justify-between items-center px-4">
            <h1
              className="text-xl font-bold cursor-pointer dark:text-white text-primary"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              WeWrite
            </h1>

            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
                <Link href="/auth/register">Sign Up</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation - Horizontally scrollable and sticky */}
        <div className="w-full bg-background/90 backdrop-blur-xl border-b border-border/10 py-3 shadow-sm">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex items-center whitespace-nowrap px-4 min-w-min gap-x-6">
              <a
                href="#activity"
                onClick={(e) => scrollToSection(e, '#activity')}
                className="text-xs font-medium transition-colors hover:text-primary px-2 py-1 flex-shrink-0"
              >
                Activity
              </a>
              <a
                href="#trending"
                onClick={(e) => scrollToSection(e, '#trending')}
                className="text-xs font-medium transition-colors hover:text-primary px-2 py-1 flex-shrink-0"
              >
                Trending
              </a>
              <a
                href="#features"
                onClick={(e) => scrollToSection(e, '#features')}
                className="text-xs font-medium transition-colors hover:text-primary px-2 py-1 flex-shrink-0"
              >
                Features
              </a>
              <a
                href="#supporters"
                onClick={(e) => scrollToSection(e, '#supporters')}
                className="text-xs font-medium transition-colors hover:text-primary px-2 py-1 flex-shrink-0"
              >
                Supporters
              </a>
              <a
                href="#about"
                onClick={(e) => scrollToSection(e, '#about')}
                className="text-xs font-medium transition-colors hover:text-primary px-2 py-1 flex-shrink-0"
              >
                About
              </a>
              <a
                href="#get-started"
                onClick={(e) => scrollToSection(e, '#get-started')}
                className="text-xs font-medium transition-colors hover:text-primary px-2 py-1 flex-shrink-0"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </div>

      <main className="pt-8 md:pt-6">
        {/* Hero Section */}
        <section
          className="py-16 md:py-20 relative overflow-hidden"
          ref={heroSectionRef}
          onMouseMove={(e) => {
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
          }}
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
                  WeWrite is a free speech platform and social wiki where every page is a fundraiser. Write a hundred pages, you've just written a hundred Kickstarters.
                </p>
                <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4">
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/auth/login">Sign In</Link>
                  </Button>
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
                    <Link href="/auth/register">Create Account</Link>
                  </Button>
                </div>
              </div>

              <div className={`flex-1 perspective-[1000px] ${fadeInClass}`} style={{ animationDelay: '0.2s' }}>
                <div className="relative w-full max-w-lg mx-auto transform-gpu transition-transform duration-300">
                  <div {...handlers} className="relative w-full h-full">
                    <div className="relative w-full h-full min-h-[420px] flex items-center justify-center">
                      <AnimatePresence initial={false} custom={slideDirection} mode="wait">
                        <motion.button
                          key={carouselIndex}
                          initial={{ x: slideDirection === 'right' ? 300 : -300, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: slideDirection === 'right' ? -300 : 300, opacity: 0 }}
                          transition={{ x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                          className="group relative block focus:outline-none w-full bg-none border-none p-0"
                          onClick={() => setLightboxOpen(true)}
                          aria-label="Open image lightbox"
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
                        </motion.button>
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
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 animate-fadeInFast"
              style={{ animation: 'fadeIn 0.2s' }}
              onClick={() => setLightboxOpen(false)} // Close lightbox when clicking the overlay
            >
              <button
                className="absolute top-6 right-8 text-white text-3xl z-20 hover:text-primary focus:outline-none"
                onClick={() => setLightboxOpen(false)}
                aria-label="Close lightbox"
              >
                &times;
              </button>
              {/* Left arrow */}
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-3 shadow hover:bg-background/90 z-20"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent closing lightbox when clicking arrow
                  setSlideDirection('left');
                  goToIndex((carouselIndex - 1 + heroImages.length) % heroImages.length);
                }}
                aria-label="Previous image"
              >
                <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
              </button>
              {/* Main image with animation and fixed container */}
              <div
                className="flex flex-col items-center justify-center"
                style={{ width: 1000, height: 800, maxWidth: '95vw', maxHeight: '85vh', minWidth: 320, minHeight: 320 }}
                onClick={(e) => e.stopPropagation()} // Prevent closing lightbox when clicking content
              >
                {/* Fixed size container to prevent layout shift */}
                <div className="relative w-full h-full" style={{ overflow: 'hidden' }}>
                  <AnimatePresence initial={false} custom={slideDirection} mode="wait">
                    <motion.div
                      key={carouselIndex}
                      initial={{ x: slideDirection === 'right' ? 300 : -300, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: slideDirection === 'right' ? -300 : 300, opacity: 0 }}
                      transition={{ x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                        <Image
                          src={heroImages[carouselIndex]}
                          alt={`Lightbox image ${carouselIndex + 1}`}
                          fill
                          className="rounded-lg shadow-2xl object-cover"
                          sizes="(max-width: 1000px) 95vw, 1000px"
                          priority
                        />
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
                {/* Filmstrip in lightbox */}
                <div className="flex justify-center gap-2 mt-6">
                  {heroImages.map((img, idx) => (
                    <button
                      key={img}
                      className={`rounded-md ${carouselIndex === idx ? 'ring-2 ring-primary' : 'ring-1 ring-border/30'} focus:outline-none overflow-hidden`}
                      style={{ width: 72, height: 48, background: 'none', padding: 0 }}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent closing lightbox when clicking thumbnail
                        setSlideDirection(idx > carouselIndex ? 'right' : 'left');
                        goToIndex(idx);
                      }}
                      aria-label={`Show image ${idx + 1}`}
                    >
                      <Image src={img} alt={`Lightbox thumbnail ${idx + 1}`} width={72} height={48} className="object-cover w-full h-full" />
                    </button>
                  ))}
                </div>
              </div>
              {/* Right arrow */}
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-3 shadow hover:bg-background/90 z-20"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent closing lightbox when clicking arrow
                  setSlideDirection('right');
                  goToIndex((carouselIndex + 1) % heroImages.length);
                }}
                aria-label="Next image"
              >
                <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          )}
        </section>

        {/* Recent Activity Carousel */}
        <section id="activity" className="py-8 bg-muted/30">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className={`text-center mb-8 ${fadeInClass}`}>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Recent Activity</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                See what's happening on WeWrite right now
              </p>
            </div>
            <div className={`${fadeInClass}`} style={{ animationDelay: '0.1s' }}>
              {/* Use the directly imported ActivityCarousel component */}
              <ActivityCarousel />
            </div>
          </div>
        </section>

        {/* Trending Pages Section */}
        <section id="trending" className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className={`text-center mb-8 ${fadeInClass}`}>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Trending Pages</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Discover the most popular content on WeWrite
              </p>
            </div>
            <div className={`${fadeInClass}`} style={{ animationDelay: '0.1s' }}>
              {/* Use our new TrendingCarousel component with more items for better looping */}
              <TrendingCarousel limit={20} />
            </div>
          </div>
        </section>

        {/* Features Kanban Section */}
        <section id="features" className="py-16 md:py-20 bg-background">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className={`text-center mb-16 ${fadeInClass}`}>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Feature Roadmap</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-4">
                Discover what makes WeWrite special and what's coming next.
              </p>
              <Button variant="outline" size="lg" className="gap-2 mx-auto" asChild>
                <Link href="/zRNwhNgIEfLFo050nyAT">
                  Read our detailed Roadmap <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* Kanban layout with horizontal scrolling */}
            <div className="overflow-x-auto pb-6">
              <div className="flex min-w-max gap-6" style={{ minWidth: '100%' }}>
                {/* Coming Soon Column */}
                <div className="flex-1 min-w-[300px]">
                  <div className="bg-muted/30 rounded-lg p-4 mb-4">
                    <h3 className="text-xl font-semibold mb-2 text-center">Coming Soon</h3>
                  </div>
                  <div className="space-y-4">
                    {comingSoonFeatures.map((feature, index) => (
                      <div
                        key={index}
                        className={`${fadeInClass}`}
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <PagePreviewCard
                          title={feature.title}
                          content={pageContents[feature.pageId]?.body || feature.description}
                          pageId={feature.pageId}
                          hideStatus={true}
                          maxContentLength={150}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* In Progress Column */}
                <div className="flex-1 min-w-[300px]">
                  <div className="bg-amber-500/10 rounded-lg p-4 mb-4">
                    <h3 className="text-xl font-semibold mb-2 text-center">In Progress</h3>
                  </div>
                  <div className="space-y-4">
                    {builtFeatures.filter(f => f.status === 'in-progress').map((feature, index) => (
                      <div
                        key={index}
                        className={`${fadeInClass}`}
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <PagePreviewCard
                          title={feature.title}
                          content={pageContents[feature.pageId]?.body || feature.description}
                          pageId={feature.pageId}
                          hideStatus={true}
                          maxContentLength={150}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Available Now Column */}
                <div className="flex-1 min-w-[300px]">
                  <div className="bg-green-500/10 rounded-lg p-4 mb-4">
                    <h3 className="text-xl font-semibold mb-2 text-center">Available Now</h3>
                  </div>
                  <div className="space-y-4">
                    {builtFeatures.filter(f => f.status === 'done').map((feature, index) => (
                      <div
                        key={index}
                        className={`${fadeInClass}`}
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <PagePreviewCard
                          title={feature.title}
                          content={pageContents[feature.pageId]?.body || feature.description}
                          pageId={feature.pageId}
                          hideStatus={true}
                          maxContentLength={150}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Supporters Section */}
        <section id="supporters" className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className={`text-center mb-12 ${fadeInClass}`}>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Supporters</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Special thanks to those who have supported WeWrite while we're still in beta.
              </p>
            </div>

            <div className={`${fadeInClass} max-w-4xl mx-auto`} style={{ animationDelay: '0.1s' }}>
              <Link
                href="https://opencollective.com/wewrite-app"
                target="_blank"
                rel="noopener noreferrer"
                className="block border border-border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200 bg-card"
              >
                <div className="p-4 text-center text-lg font-medium border-b border-border">
                  Our Financial Contributors on Open Collective
                </div>
                <div className="p-6">
                  <Image
                    src="/images/landing/OpenCollective.png"
                    alt="WeWrite supporters on Open Collective"
                    width={1000}
                    height={300}
                    className="w-full h-auto rounded-md"
                  />
                </div>
                <div className="p-4 text-center border-t border-border">
                  <Button variant="outline" className="gap-2">
                    View on Open Collective <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className={`text-center mb-16 ${fadeInClass}`}>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">About WeWrite</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Built with modern technologies for the best user experience
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {techStack.map((tech, index) => (
                <div
                  key={index}
                  className={`${fadeInClass}`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <Card className="h-full hover:shadow-lg transition-all duration-200">
                    <CardHeader>
                      <CardTitle>{tech.title}</CardTitle>
                      <CardDescription>
                        {tech.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              ))}
            </div>


          </div>
        </section>

        {/* Ready to Get Started Section */}
        <section id="get-started" className="py-16 md:py-20 bg-background">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className={`text-center mb-8 ${fadeInClass}`}>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Get Started?</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Join WeWrite today and start creating, sharing, and earning from your content.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button size="lg" variant="outline" asChild>
                  <Link href="/auth/login">Sign In</Link>
                </Button>
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
                  <Link href="/auth/register">Create Account</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;

// Add CSS for slide-left and slide-right
// In your global CSS or a <style jsx global> block:
/*
.slide-left {
  animation: slideLeft 0.4s cubic-bezier(0.4,0,0.2,1);
}
.slide-right {
  animation: slideRight 0.4s cubic-bezier(0.4,0,0.2,1);
}
@keyframes slideLeft {
  from { opacity: 0; transform: translateX(-60px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes slideRight {
  from { opacity: 0; transform: translateX(60px); }
  to { opacity: 1; transform: translateX(0); }
}
*/
