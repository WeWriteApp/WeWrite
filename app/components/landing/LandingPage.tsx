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
import { useTheme } from "next-themes";
import PillLink from "../utils/PillLink";
import ActivityCarousel from './ActivityCarousel';
import SimpleTrendingCarousel from './SimpleTrendingCarousel';
import { useSwipeable } from 'react-swipeable';
import { AnimatePresence, motion } from 'framer-motion';
// Import server components for activity and trending data
import dynamic from 'next/dynamic';
// Import analytics hooks and constants
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from '../../constants/analytics-events';
import { openExternalLink } from '../../utils/pwa-detection';
import { useAuth } from '../../providers/AuthProvider';

// Import client-side components for simplified stacked layout
import HeroCard from './HeroCard';

import { DynamicPagePreviewCard } from './DynamicPagePreviewCard';
import { LoggedOutFinancialHeader } from './LoggedOutFinancialHeader';
import { WeWriteLogo } from '../ui/WeWriteLogo';
import SiteFooter from '../layout/SiteFooter';
import { fetchLandingPageCards, type LandingPageCardConfig } from '../../config/landingPageCards';

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

  // Landing page cards state
  const [landingPageCards, setLandingPageCards] = useState<LandingPageCardConfig[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);

  // Animation classes
  const fadeInClass = "animate-fadeIn";

  // Fetch landing page cards configuration
  useEffect(() => {
    const loadCards = async () => {
      try {
        setCardsLoading(true);
        const cards = await fetchLandingPageCards();
        setLandingPageCards(cards);
      } catch (error) {
        console.error('Failed to load landing page cards:', error);
        // Fallback to static configuration
        const { getEnabledLandingPageCards } = await import('../../config/landingPageCards');
        setLandingPageCards(getEnabledLandingPageCards());
      } finally {
        setCardsLoading(false);
      }
    };

    loadCards();
  }, []);

  useEffect(() => {
    let hasScrolledDown = false;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 10);



      // Simplified - no section navigation needed for stacked layout

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

  // Use user's current accent color on landing page mount (no forced blue)
  useEffect(() => {
    // Landing page now respects user's theme preferences
    // No forced color changes - let the theme system handle it
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
        return <Badge variant="default" className="bg-success-20 text-success">Available Now</Badge>;
      case 'in-progress':
        return <Badge variant="secondary" className="bg-amber-500 text-white">In Progress</Badge>;
      case 'coming-soon':
        return <Badge variant="secondary">Coming Soon</Badge>;
      default:
        return null;
    }
  };

  // Simplified - no animation functions needed

  return (
    <div className="min-h-screen bg-background dark:bg-background">


      {/* Desktop Navigation - Always sticky at the top */}
      <header className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-300 ${isMobileView ? 'hidden' : 'block'} shadow-md`} style={{ backgroundColor: 'hsl(var(--background)) !important', backdropFilter: 'none !important', WebkitBackdropFilter: 'none !important' }}>
        {/* Row 1: Logo + Navigation + Auth */}
        <div className="border-b border-border/20 py-2">
          <div className="container mx-auto max-w-4xl flex justify-between items-center px-6">
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
                  className="bg-muted hover:bg-muted/80 text-foreground"
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
                <Button variant="default" className="bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                  <Link href="/auth/register">Create Account</Link>
                </Button>
              </>
            ) : (
              <Button
                variant="success"
                asChild
              >
                <Link href="/new">Create Page</Link>
              </Button>
            )}
          </div>
        </div>
        </div>

        {/* Bottom gradient for smooth content transition */}
        <div className="absolute -bottom-4 left-0 right-0 h-4 bg-gradient-to-b from-background to-transparent pointer-events-none" />
      </header>

      {/* Mobile Navigation - Always sticky at the top */}
      <div className={`${isMobileView ? 'block' : 'hidden'} fixed top-0 left-0 right-0 z-50 flex flex-col w-full`}>
        {/* Title and buttons */}
        <div className="w-full bg-background/90 backdrop-blur-xl shadow-sm py-2">
          <div className="container mx-auto max-w-4xl flex justify-between items-center px-4">
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
                    className="bg-muted hover:bg-muted/80 text-foreground"
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
                  <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                    <Link href="/auth/register">Sign Up</Link>
                  </Button>
                </>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  className="bg-success-20 hover:bg-success-30 text-success"
                  asChild
                >
                  <Link href="/new">Create Page</Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom gradient for smooth content transition */}
        <div className="absolute -bottom-4 left-0 right-0 h-4 bg-gradient-to-b from-background to-transparent pointer-events-none" />
      </div>

      <main className={`${isMobileView ? 'pt-20' : 'pt-16'}`}>
        {/* Floating Financial Header */}
        <LoggedOutFinancialHeader />

        {/* SEO Content - Hidden but accessible to search engines */}
        <div className="sr-only">
          <h1>WeWrite - The Social Wiki Where Every Page is a Fundraiser</h1>
          <p>
            WeWrite is a revolutionary collaborative writing platform that combines the power of social wikis with innovative fundraising capabilities.
            Create, edit, and share content with a global community while supporting your favorite writers through our unique page-based donation system.
            Our platform enables real-time collaborative editing, allowing multiple users to work together seamlessly on documents, articles, stories, and any type of written content.
          </p>
          <p>
            Join writers, readers, and content creators who are building the future of collaborative content creation.
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



        {/* Simplified Stacked Cards Layout */}
        <section className="py-8 md:py-12 pt-24 md:pt-28">
          <div className="container mx-auto px-6 max-w-4xl space-y-8">

            {/* Write Share Earn Card */}
            <HeroCard
              fadeInClass={fadeInClass}
              platformOptions={[]} // Remove swappable text
              platformIndex={0}
              handlePlatformClick={() => {}} // No-op
              platformRef={React.createRef()}
            />

            {/* Dynamic Page Preview Cards */}
            {cardsLoading ? (
              // Loading skeleton for cards
              <div className="space-y-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="min-h-[500px] bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              landingPageCards.map((cardConfig) => (
                <DynamicPagePreviewCard
                  key={cardConfig.id}
                  pageId={cardConfig.pageId}
                  customTitle={cardConfig.customTitle}
                  buttonText={cardConfig.buttonText}
                  maxLines={cardConfig.maxLines}
                  showAllocationBar={cardConfig.showAllocationBar}
                  authorId={cardConfig.authorId}
                  allocationSource={cardConfig.allocationSource}
                  className={cardConfig.className}
                />
              ))
            )}

          </div>
        </section>

        {/* Recent Activity Carousel */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Recent Activity</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                See what the WeWrite community is creating and editing right now
              </p>
            </div>
            <ActivityCarousel limit={30} />
          </div>
        </section>

        {/* Trending Pages Carousel */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Trending Pages</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Discover the most popular content on WeWrite
              </p>
            </div>
            <SimpleTrendingCarousel limit={20} />
          </div>
        </section>

        {/* Bottom spacing for footer visibility */}
        <div className="pb-32 md:pb-24"></div>

      </main>

      {/* Global Footer */}
      <SiteFooter />
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