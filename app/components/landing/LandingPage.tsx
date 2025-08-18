"use client";

import React, { useEffect, useState, useRef, lazy, Suspense, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '../../components/ui/button';
import { Check, ArrowRight, Flame, Loader, User, Activity, FileText, Heart, Info, Clock, Wrench } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Separator } from "../../components/ui/separator";
import Header from '../marketing/Header';
import { PagePreviewCard } from './PagePreviewCard';
import { useTheme } from "next-themes";
import PillLink from "../utils/PillLink";
import { useSwipeable } from 'react-swipeable';
import { AnimatePresence, motion } from 'framer-motion';
// Import server components for activity and trending data
import dynamic from 'next/dynamic';
// Import analytics hooks and constants
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from '../../constants/analytics-events';
import { openExternalLink } from '../../utils/pwa-detection';
import { useAuth } from '../../providers/AuthProvider';

// Import client-side components instead of server components
import ActivityCarousel from './ActivityCarousel';
import SimpleTrendingCarousel from './SimpleTrendingCarousel';
import PaginatedCarousel from './PaginatedCarousel';
import HeroCard from './HeroCard';
import FeatureRoadmapCard from './FeatureRoadmapCard';
import UseCasesCard from './UseCasesCard';

import { DynamicPagePreviewCard } from './DynamicPagePreviewCard';
import { LoggedOutFinancialHeader } from './LoggedOutFinancialHeader';
import { WeWriteLogo } from '../ui/WeWriteLogo';

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);

  const { setTheme, theme } = useTheme();
  const [session, setUser] = useState<any>(null);

  // Authentication state
  const { user, isAuthenticated } = useAuth();

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
    let hasScrolledDown = false;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 10);



      // Determine which section is currently in view
      const sections = ['hero', 'activity', 'trending', 'about'];
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



  // Check if user is logged in using hybrid session architecture
  useEffect(() => {
    // Use the session management system instead of direct Firebase auth
    // The user state is already managed by the SessionAuthInitializer and Zustand store
    // No need for direct Firebase auth listener here
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
        return <Badge variant="default" className="bg-success text-success-foreground">Available Now</Badge>;
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

  // No longer need roadmap scroll navigation since we're using a filterable list

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
      <header className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-300 ${isMobileView ? 'hidden' : 'block'} bg-background/90 backdrop-blur-xl shadow-md`}>
        {/* Row 1: Logo + Navigation + Auth */}
        <div className="border-b border-border/20 py-2">
          <div className="container mx-auto flex justify-between items-center px-6">
          <div className="flex items-center space-x-6">
            <WeWriteLogo
              size="lg"
              styled={true}
              clickable={true}
              showText={true}
              priority={true}
              onClick={() => {
                // Track logo click in Google Analytics
                analytics.trackInteractionEvent(ANALYTICS_EVENTS.LINK_CLICKED, {
                  label: 'Logo click: go to home',
                  link_type: 'logo',
                  link_text: 'WeWrite',
                  link_url: '/'
                });
                // Navigate to home page instead of scrolling to top
                window.location.href = '/';
              }}
            />


          </div>

          <div className="flex items-center space-x-4">
            {!isAuthenticated ? (
              <>
                <Button
                  variant="secondary"
                  className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
                  asChild
                >
                  <Link
                    href="/auth/login"
                    onClick={() => {
                      console.log('🟠 Desktop Sign In button clicked');
                      // Track desktop sign-in click in analytics
                      analytics.trackInteractionEvent(ANALYTICS_EVENTS.LINK_CLICKED, {
                        label: 'Desktop sign-in button',
                        link_type: 'auth',
                        link_text: 'Sign In',
                        link_url: '/auth/login',
                        device: 'desktop'
                      });
                    }}
                  >
                    Sign In
                  </Link>
                </Button>
                <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
                  <Link href="/auth/register">Create Account</Link>
                </Button>
              </>
            ) : (
              <Button
                variant="default"
                className="bg-green-600 hover:bg-green-700 text-white"
                asChild
              >
                <Link href="/new">Create Page</Link>
              </Button>
            )}
          </div>
        </div>
        </div>

        {/* Row 2: Allocation Bar */}
        <div className="py-1.5 bg-background/95">
          <div className="container mx-auto px-6">
            <LoggedOutFinancialHeader />
          </div>
        </div>
      </header>

      {/* Mobile Navigation - Always sticky at the top */}
      <div className={`${isMobileView ? 'block' : 'hidden'} fixed top-0 left-0 right-0 z-50 flex flex-col w-full`}>
        {/* Title and buttons */}
        <div className="w-full bg-background/90 backdrop-blur-xl shadow-sm py-2">
          <div className="container mx-auto flex justify-between items-center px-4">
            <WeWriteLogo
              size="md"
              styled={true}
              clickable={true}
              showText={true}
              priority={true}
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
            />

            <div className="flex items-center space-x-2">
              {!isAuthenticated ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
                    asChild
                  >
                    <Link
                      href="/auth/login"
                      onClick={() => {
                        console.log('🟠 Mobile Sign In button clicked');
                        // Track mobile sign-in click in analytics
                        analytics.trackInteractionEvent(ANALYTICS_EVENTS.LINK_CLICKED, {
                          label: 'Mobile sign-in button',
                          link_type: 'auth',
                          link_text: 'Sign In',
                          link_url: '/auth/login',
                          device: 'mobile'
                        });
                      }}
                    >
                      Sign In
                    </Link>
                  </Button>
                  <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
                    <Link href="/auth/register">Sign Up</Link>
                  </Button>
                </>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  asChild
                >
                  <Link href="/new">Create Page</Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Allocation Bar */}
        <div className="w-full bg-background/95 py-1.5 border-t border-border/20">
          <div className="container mx-auto px-4">
            <LoggedOutFinancialHeader />
          </div>
        </div>


      </div>

      <main className={`${isMobileView ? 'pt-20' : 'pt-16'}`}>
        {/* SEO Content - Hidden but accessible to search engines */}
        <div className="sr-only">
          <h1>WeWrite - The Social Wiki Where Every Page is a Fundraiser</h1>
          <p>
            WeWrite is a revolutionary collaborative writing platform that combines the power of social wikis with innovative fundraising capabilities.
            Create, edit, and share content with a global community while supporting your favorite writers through our unique page-based donation system.
            Our platform enables real-time collaborative editing, allowing multiple users to work together seamlessly on documents, articles, stories, and any type of written content.
          </p>
          <p>
            Join thousands of writers, readers, and content creators who are building the future of collaborative content creation.
            Whether you're writing fiction, non-fiction, technical documentation, creative content, blog posts, research papers, or educational materials,
            WeWrite provides the comprehensive tools and supportive community you need to succeed in your writing journey.
          </p>
          <p>
            Our comprehensive feature set includes collaborative real-time editing with live cursors and instant synchronization,
            innovative page-based fundraising system that allows readers to directly support their favorite content creators,
            advanced trending content algorithms that surface the most engaging and popular writing,
            detailed user reputation and leaderboard systems that recognize top contributors,
            powerful group collaboration spaces for teams and communities, comprehensive activity tracking and social feeds,
            multiple customizable reading modes for optimal user experience, fully responsive design optimized for all devices and screen sizes,
            and a vibrant, supportive writing community that encourages creativity and collaboration.
          </p>
          <p>
            The platform supports various content types including articles, stories, documentation, tutorials, research papers, creative writing,
            technical guides, educational content, collaborative projects, and community-driven initiatives.
            Writers can monetize their content through our unique fundraising system while readers can discover and support quality content.
            Advanced features include version control, comment systems, real-time notifications, user profiles, content analytics,
            search functionality, tagging systems, and integration with external tools and platforms.
          </p>
          <p>
            WeWrite revolutionizes online content creation by combining Wikipedia-style collaborative editing with modern social features
            and innovative monetization options. Users can create public or private pages, invite collaborators, track changes,
            manage permissions, and build communities around shared interests and projects.
            The platform emphasizes quality content, user engagement, and fair compensation for creators while maintaining
            an ad-free environment focused on authentic content and meaningful connections.
          </p>
        </div>



        {/* Hero Carousel - Paginated cards with hero, roadmap, and use cases */}
        <section id="hero" className="py-16 md:py-20 bg-background">
          {/* Allow carousel to extend to screen edges for proper overflow visibility */}
          <PaginatedCarousel
            autoPlay={true}
            autoPlayInterval={8000}
            showArrows={true}
            showDots={true}
            className="min-h-[600px]"
          >
            <HeroCard
              fadeInClass={fadeInClass}
              platformOptions={platformOptions}
              platformIndex={platformIndex}
              handlePlatformClick={handlePlatformClick}
              platformRef={platformRef}
            />
            <FeatureRoadmapCard fadeInClass={fadeInClass} />
            <UseCasesCard fadeInClass={fadeInClass} />
          </PaginatedCarousel>
        </section>

        {/* Recent Edits Carousel - Lazy loaded */}
        <section id="activity" ref={activityRef} className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className={`text-center mb-8 ${fadeInClass}`}>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-3">
                <Activity className="h-7 w-7" />
                Recent Edits
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                See what's happening on WeWrite right now
              </p>
            </div>
          </div>
          <div className={`${fadeInClass}`} style={{ animationDelay: '0.1s' }}>
            {/* Only render carousel when section is visible */}
            {activityVisible ? (
              <ActivityCarousel />
            ) : (
              <div style={{ height: '220px' }} className="flex items-center justify-center">
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



        {/* Bottom spacing for footer visibility */}
        <div className="pb-32 md:pb-24"></div>

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