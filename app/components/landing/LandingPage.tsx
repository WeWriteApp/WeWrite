"use client";

import React, { useEffect, useState, useRef, lazy, Suspense, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '../../components/ui/button';
import { Check, ArrowRight, Flame, Loader, User, Activity, FileText, Heart, Info } from 'lucide-react';
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
// Import server components for activity and trending data
import dynamic from 'next/dynamic';
// Import analytics hooks and constants
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from '../../constants/analytics-events';
import { openExternalLink } from '../../utils/pwa-detection';

// Import simple client-side components instead of server components
import SimpleActivityCarousel from './SimpleActivityCarousel';
import SimpleTrendingCarousel from './SimpleTrendingCarousel';
import HeroSection from './HeroSection';

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);
  const { setTheme, theme } = useTheme();
  const [pageContents, setPageContents] = useState<Record<string, any>>({});

  // Analytics hook for tracking
  const analytics = useWeWriteAnalytics();

  // Lazy loading for carousels
  const [activityVisible, setActivityVisible] = useState(false);
  const [trendingVisible, setTrendingVisible] = useState(false);
  const activityRef = useRef<HTMLDivElement>(null);
  const trendingRef = useRef<HTMLDivElement>(null);

  // Interactive fundraiser platform text
  const [platformIndex, setPlatformIndex] = useState(0);
  const [isAnimatingPlatform, setIsAnimatingPlatform] = useState(false);
  const platformRef = useRef<HTMLSpanElement>(null);
  const platformOptions = ["Kickstarters", "GoFundMes", "Patreons", "OpenCollectives", "Memberfuls"];

  // Animation classes
  const fadeInClass = "animate-fadeIn";

  // Set up intersection observer for lazy loading
  useEffect(() => {
    // Create an observer for lazy loading
    const observerOptions = {
      root: null, // Use viewport as root
      rootMargin: '100px', // Load when within 100px of viewport
      threshold: 0.1 // Trigger when 10% visible
    };

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.target.id === 'activity' && entry.isIntersecting) {
          setActivityVisible(true);
        } else if (entry.target.id === 'trending' && entry.isIntersecting) {
          setTrendingVisible(true);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, observerOptions);

    // Observe sections for lazy loading
    if (activityRef.current) observer.observe(activityRef.current);
    if (trendingRef.current) observer.observe(trendingRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);

      // Determine which section is currently in view
      const sections = ['activity', 'trending', 'features', 'supporters', 'about'];
      const headerHeight = isMobileView ? 100 : 60; // Mobile: 100px, Desktop: 60px

      // Find the section that is currently in view
      for (const sectionId of sections) {
        const section = document.getElementById(sectionId);
        if (section) {
          const rect = section.getBoundingClientRect();
          // Check if the section is in view (accounting for header height)
          if (rect.top <= headerHeight + 100 && rect.bottom >= headerHeight) {
            setActiveSection(sectionId);
            break;
          }
        }
      }

      // If we're at the top of the page, clear the active section
      if (window.scrollY < 100) {
        setActiveSection('');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isMobileView]);

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
              // Extract text content from nodes, properly handling links
              body = contentObj.map((node: any) => {
                if (node.type === 'paragraph' && node.children) {
                  return node.children.map((child: any) => {
                    // Handle link nodes by extracting their text content
                    if (child.type === 'link' && child.children) {
                      return child.children.map((linkChild: any) => linkChild.text || '').join('');
                    }
                    // Handle regular text nodes
                    return child.text || '';
                  }).join('');
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

  // Removed lightbox keyboard navigation - not needed in this component

  // Handle screen resize to detect when to switch to mobile view
  useEffect(() => {
    // Function to check if we need to switch to mobile view
    const checkMobileView = () => {
      // Switch to mobile view at 1024px (before links start wrapping)
      // This is wider than the standard md breakpoint (768px)
      setIsMobileView(window.innerWidth < 1024);
    };

    // Initial checks
    checkMobileView();

    // Wait for DOM to be fully rendered before checking overflow
    setTimeout(checkNavOverflow, 100);

    // Combined resize handler for proper cleanup
    const handleResize = () => {
      checkMobileView();
      checkNavOverflow();
    };

    // Add event listener with the combined handler
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Function to check if mobile nav links are overflowing
  const checkNavOverflow = () => {
    const navContainer = document.querySelector('.overflow-x-auto');
    const navLinks = document.querySelector('.mobile-nav-links');

    if (navContainer && navLinks) {
      // Check if the links are wider than the container
      const isOverflowing = navLinks.scrollWidth > navContainer.clientWidth;

      // Apply appropriate class based on overflow state
      if (isOverflowing) {
        navLinks.classList.remove('justify-center');
        navLinks.classList.add('justify-start');
      } else {
        navLinks.classList.remove('justify-start');
        navLinks.classList.add('justify-center');
      }
    }
  };

  // Smooth scroll function for anchor links
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const targetId = href.replace('#', '');
    const targetElement = document.getElementById(targetId);

    // Track the anchor link click in Google Analytics
    analytics.trackInteractionEvent(ANALYTICS_EVENTS.LINK_CLICKED, {
      label: `Anchor link: ${targetId}`,
      section_name: targetId,
      link_type: 'anchor',
      link_text: e.currentTarget.textContent || targetId,
      link_url: href
    });

    if (targetElement) {
      // Adjust header height based on mobile view state
      const headerHeight = isMobileView ? 100 : 60; // Mobile: 100px (includes both header rows), Desktop: 60px
      const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - headerHeight;

      // Scroll to the section
      window.scrollTo({ top: targetPosition, behavior: 'smooth' });
      window.history.pushState(null, '', href);

      // Center the tab in mobile view
      if (isMobileView) {
        // Find the clicked anchor element
        const clickedTab = e.currentTarget;
        const tabsContainer = document.querySelector('.overflow-x-auto');

        if (clickedTab && tabsContainer) {
          // Calculate the center position
          const containerWidth = tabsContainer.clientWidth;
          const tabPosition = clickedTab.offsetLeft;
          const tabWidth = clickedTab.offsetWidth;
          const centerPosition = tabPosition - (containerWidth / 2) + (tabWidth / 2);

          // Scroll the tabs container horizontally with animation
          tabsContainer.scrollTo({
            left: centerPosition,
            behavior: 'smooth'
          });

          // Check for overflow after scrolling
          setTimeout(checkNavOverflow, 300);
        }
      }

      // Update active section
      setActiveSection(targetId);
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



  // Animation function for text cycling
  const animateTextChange = (element: HTMLElement | null, newText: string, callback: () => void) => {
    if (!element) return;

    const originalText = element.innerText;
    const frames = 10; // Number of animation frames
    let frame = 0;

    const animate = () => {
      if (frame < frames) {
        // During first half, scramble the text
        if (frame < frames / 2) {
          const progress = frame / (frames / 2);
          const scrambleLength = Math.floor(originalText.length * progress);
          const keepLength = originalText.length - scrambleLength;

          let scrambledText = originalText.substring(0, keepLength);
          for (let i = 0; i < scrambleLength; i++) {
            scrambledText += String.fromCharCode(33 + Math.floor(Math.random() * 94)); // Random ASCII
          }

          element.innerText = scrambledText;
        }
        // During second half, reveal the new text
        else {
          const progress = (frame - frames / 2) / (frames / 2);
          const revealLength = Math.floor(newText.length * progress);

          let revealedText = newText.substring(0, revealLength);
          for (let i = 0; i < newText.length - revealLength; i++) {
            revealedText += String.fromCharCode(33 + Math.floor(Math.random() * 94)); // Random ASCII
          }

          element.innerText = revealedText;
        }

        frame++;
        requestAnimationFrame(animate);
      } else {
        // Animation complete
        element.innerText = newText;
        callback();
      }
    };

    animate();
  };

  // Handle platform text click
  const handlePlatformClick = () => {
    if (isAnimatingPlatform) return;

    // Track platform text click in Google Analytics
    analytics.trackInteractionEvent(ANALYTICS_EVENTS.LINK_CLICKED, {
      label: `Platform text click: ${platformOptions[platformIndex]} → ${platformOptions[(platformIndex + 1) % platformOptions.length]}`,
      link_type: 'interactive_text',
      link_text: platformOptions[platformIndex],
      next_text: platformOptions[(platformIndex + 1) % platformOptions.length]
    });

    setIsAnimatingPlatform(true);
    const nextIndex = (platformIndex + 1) % platformOptions.length;

    animateTextChange(
      platformRef.current,
      platformOptions[nextIndex],
      () => {
        setPlatformIndex(nextIndex);
        setIsAnimatingPlatform(false);
      }
    );
  };



  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Navigation - Always sticky at the top */}
      <header className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-300 ${isMobileView ? 'hidden' : 'block'} bg-background/90 backdrop-blur-xl shadow-md py-3`}>
        <div className="container mx-auto flex justify-between items-center px-6">
          <div className="flex items-center space-x-6">
            <h1
              className="text-2xl font-bold cursor-pointer dark:text-white text-primary"
              onClick={() => {
                // Track logo click in Google Analytics
                analytics.trackInteractionEvent(ANALYTICS_EVENTS.LINK_CLICKED, {
                  label: 'Logo click: scroll to top',
                  link_type: 'logo',
                  link_text: 'WeWrite',
                  link_url: '#top'
                });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              WeWrite
            </h1>

            <nav className="flex space-x-6">
              <a
                href="#activity"
                onClick={(e) => scrollToSection(e, '#activity')}
                className={`text-sm font-medium hover:text-primary transition-colors flex items-center gap-1.5 ${activeSection === 'activity' ? 'text-blue-600 font-semibold' : ''}`}
              >
                <Activity className="h-4 w-4" />
                Recent Activity
              </a>
              <a
                href="#trending"
                onClick={(e) => scrollToSection(e, '#trending')}
                className={`text-sm font-medium hover:text-primary transition-colors flex items-center gap-1.5 ${activeSection === 'trending' ? 'text-blue-600 font-semibold' : ''}`}
              >
                <Flame className="h-4 w-4" />
                Trending
              </a>
              <a
                href="#features"
                onClick={(e) => scrollToSection(e, '#features')}
                className={`text-sm font-medium hover:text-primary transition-colors flex items-center gap-1.5 ${activeSection === 'features' ? 'text-blue-600 font-semibold' : ''}`}
              >
                <FileText className="h-4 w-4" />
                Roadmap
              </a>
              <a
                href="#supporters"
                onClick={(e) => scrollToSection(e, '#supporters')}
                className={`text-sm font-medium hover:text-primary transition-colors flex items-center gap-1.5 ${activeSection === 'supporters' ? 'text-blue-600 font-semibold' : ''}`}
              >
                <Heart className="h-4 w-4" />
                Support us
              </a>


            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <Button
              variant="secondary"
              className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
              asChild
            >
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
              <Link href="/auth/register">Create Account</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation - Always sticky at the top */}
      <div className={`${isMobileView ? 'block' : 'hidden'} fixed top-0 left-0 right-0 z-50 flex flex-col w-full`}>
        {/* Title and buttons */}
        <div className="w-full bg-background/90 backdrop-blur-xl shadow-sm py-2">
          <div className="container mx-auto flex justify-between items-center px-4">
            <h1
              className="text-xl font-bold cursor-pointer dark:text-white text-primary"
              onClick={() => {
                // Track mobile logo click in Google Analytics
                analytics.trackInteractionEvent(ANALYTICS_EVENTS.LINK_CLICKED, {
                  label: 'Mobile logo click: scroll to top',
                  link_type: 'logo',
                  link_text: 'WeWrite',
                  link_url: '#top',
                  device: 'mobile'
                });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              WeWrite
            </h1>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
                asChild
              >
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
                <Link href="/auth/register">Sign Up</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation - Horizontally scrollable */}
        <div className="w-full bg-background/90 backdrop-blur-xl border-b border-border/10 py-3 shadow-sm">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex items-center whitespace-nowrap px-4 min-w-min gap-x-6 justify-center mobile-nav-links">
              <a
                href="#activity"
                onClick={(e) => scrollToSection(e, '#activity')}
                className={`text-xs font-medium transition-colors hover:text-primary px-2 py-1 flex-shrink-0 flex items-center gap-1.5 ${activeSection === 'activity' ? 'text-blue-600 font-semibold' : ''}`}
              >
                <Activity className="h-3 w-3" />
                Activity
              </a>
              <a
                href="#trending"
                onClick={(e) => scrollToSection(e, '#trending')}
                className={`text-xs font-medium transition-colors hover:text-primary px-2 py-1 flex-shrink-0 flex items-center gap-1.5 ${activeSection === 'trending' ? 'text-blue-600 font-semibold' : ''}`}
              >
                <Flame className="h-3 w-3" />
                Trending
              </a>
              <a
                href="#features"
                onClick={(e) => scrollToSection(e, '#features')}
                className={`text-xs font-medium transition-colors hover:text-primary px-2 py-1 flex-shrink-0 flex items-center gap-1.5 ${activeSection === 'features' ? 'text-blue-600 font-semibold' : ''}`}
              >
                <FileText className="h-3 w-3" />
                Roadmap
              </a>
              <a
                href="#supporters"
                onClick={(e) => scrollToSection(e, '#supporters')}
                className={`text-xs font-medium transition-colors hover:text-primary px-2 py-1 flex-shrink-0 flex items-center gap-1.5 ${activeSection === 'supporters' ? 'text-blue-600 font-semibold' : ''}`}
              >
                <Heart className="h-3 w-3" />
                Support us
              </a>


            </div>
          </div>
        </div>
      </div>

      <main className={`${isMobileView ? 'pt-24' : 'pt-20'}`}>
        {/* Hero Section - Isolated to prevent re-renders affecting other components */}
        <HeroSection
          fadeInClass={fadeInClass}
          platformOptions={platformOptions}
          platformIndex={platformIndex}
          isAnimatingPlatform={isAnimatingPlatform}
          handlePlatformClick={handlePlatformClick}
          platformRef={platformRef}
        />

        {/* Recent Activity Carousel - Lazy loaded */}
        <section id="activity" ref={activityRef} className="py-8 bg-muted/30">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className={`text-center mb-8 ${fadeInClass}`}>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-3">
                <Activity className="h-7 w-7" />
                Recent Activity
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                See what's happening on WeWrite right now
              </p>
            </div>
          </div>
          <div className={`${fadeInClass}`} style={{ animationDelay: '0.1s' }}>
            {/* Only render carousel when section is visible */}
            {activityVisible ? (
              <SimpleActivityCarousel />
            ) : (
              <div style={{ height: '200px' }} className="flex items-center justify-center">
                <p className="text-muted-foreground">Loading activity...</p>
              </div>
            )}
          </div>
        </section>

        {/* Trending Pages Section - Lazy loaded */}
        <section id="trending" ref={trendingRef} className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className={`text-center mb-8 ${fadeInClass}`}>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-3">
                <Flame className="h-7 w-7" />
                Trending Pages
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Discover the most popular content on WeWrite
              </p>
            </div>
          </div>
          <div className={`${fadeInClass}`} style={{ animationDelay: '0.1s' }}>
            {/* Only render carousel when section is visible */}
            {trendingVisible ? (
              <SimpleTrendingCarousel limit={20} />
            ) : (
              <div style={{ height: '240px' }} className="flex items-center justify-center">
                <p className="text-muted-foreground">Loading trending pages...</p>
              </div>
            )}
          </div>
        </section>

        {/* Features Kanban Section */}
        <section id="features" className="py-16 md:py-20 bg-background">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className={`text-center mb-16 ${fadeInClass}`}>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-3">
                <FileText className="h-7 w-7" />
                Roadmap
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-4">
                Discover what makes WeWrite special and what's coming next.
              </p>
              <Button variant="outline" size="lg" className="gap-2 mx-auto" asChild>
                <Link href="/zRNwhNgIEfLFo050nyAT">
                  <FileText className="h-4 w-4" /> Read our detailed Roadmap <ArrowRight className="h-4 w-4" />
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
            <div className={`text-center mb-6 ${fadeInClass}`}>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-3">
                <Heart className="h-7 w-7" />
                Support us
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-6">
                Special thanks to those who have supported WeWrite while we're still in beta.
              </p>
              <Button
                variant="default"
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => openExternalLink('https://opencollective.com/wewrite-app', 'Landing Page Support Button')}
              >
                <Heart className="h-4 w-4" /> Support on OpenCollective <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className={`${fadeInClass} max-w-4xl mx-auto`} style={{ animationDelay: '0.1s' }}>
              <div
                onClick={() => openExternalLink('https://opencollective.com/wewrite-app', 'Landing Page OpenCollective Image')}
                className="block border border-border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200 bg-card cursor-pointer"
              >
                <div className="p-6">
                  <Image
                    src="/images/landing/OpenCollective.png"
                    alt="WeWrite supporters on Open Collective"
                    width={1000}
                    height={300}
                    className="w-full h-auto rounded-md"
                  />
                </div>
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
