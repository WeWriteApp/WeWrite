"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { AuthButton } from '../auth/AuthButton';
import { Badge } from '../../components/ui/badge';
import { useTheme } from "next-themes";
import ActivityCarousel from './ActivityCarousel';
import SimpleTrendingCarousel from './SimpleTrendingCarousel';
// Import analytics hooks and constants
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { ANALYTICS_EVENTS } from '../../constants/analytics-events';
import { useAuth } from '../../providers/AuthProvider';

// Import client-side components for simplified stacked layout
import HeroCard from './HeroCard';
import HowItWorksSection from './HowItWorksSection';
import FeaturesCarousel from './FeaturesCarousel';

import { LandingColorProvider } from './LandingColorContext';
// LandingBlobs is now rendered globally via GlobalLandingBlobs in root layout
// This ensures blobs persist across page transitions between landing and auth pages
import { LoggedOutFinancialHeader } from './LoggedOutFinancialHeader';
import { WeWriteLogo } from '../ui/WeWriteLogo';
import { ModeToggle } from '../ui/mode-toggle';
import SiteFooter from '../layout/SiteFooter';
import LoggedOutNoteDrawer from './LoggedOutNoteDrawer';
import { Plus } from 'lucide-react';

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);
  const [isStackedHeader, setIsStackedHeader] = useState(false);
  const [isNoteDrawerOpen, setIsNoteDrawerOpen] = useState(false);

  const { setTheme, theme } = useTheme();
  const [session, setUser] = useState<any>(null);

  // Authentication state
  const { user, isAuthenticated } = useAuth();

  // Analytics hook for tracking
  const analytics = useWeWriteAnalytics();

  // Animation classes
  const fadeInClass = "animate-fadeIn";

  // Simple scroll handler for header shadow effect only
  // Color animation is now handled by LandingColorContext
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);

      // Clear active section when at top
      if (window.scrollY < 100) {
        setActiveSection('');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);



  // Check if user is logged in using hybrid session architecture
  useEffect(() => {
    // Use the session management system instead of direct Firebase auth
    // The user state is already managed by the SessionAuthInitializer and Zustand store
    // No need for direct Firebase auth listener here
  }, []);




  // Removed lightbox keyboard navigation - not needed in this component

  // Handle screen resize to detect when to switch to mobile view
  useEffect(() => {
    // Function to check if we need to switch to mobile view
    const checkMobileView = () => {
      // Switch to mobile view at 1024px (before links start wrapping)
      // This is wider than the standard md breakpoint (768px)
      setIsMobileView(window.innerWidth < 1024);
      // Check for very thin screens where header stacks
      setIsStackedHeader(window.innerWidth < 400);
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
    <LandingColorProvider>
    <div className="landing-page-root min-h-screen bg-background dark:bg-background">
      {/* Background blobs are now rendered globally via GlobalLandingBlobs for persistence */}

      {/* Desktop Navigation */}
      <header className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-300 ${isMobileView ? 'hidden' : 'block'}`}>
        {/* Glassmorphic background with bottom border - uses card theme CSS variables for consistent styling */}
        <div className="absolute inset-0 backdrop-blur-md border-b" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }} />
        {/* Row 1: Logo + Navigation + Auth */}
        <div className="py-2 relative z-10">
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
            <ModeToggle />
            {!isAuthenticated ? (
              <>
                <AuthButton
                  type="login"
                  variant="secondary"
                  device="desktop"
                />
                <AuthButton
                  type="register"
                  variant="default"
                  device="desktop"
                >
                  Create Account
                </AuthButton>
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

      </header>

      {/* Mobile Navigation */}
      <div className={`${isMobileView ? 'block' : 'hidden'} fixed top-0 left-0 right-0 z-50 flex flex-col w-full`}>
        {/* Glassmorphic background with bottom border - uses card theme CSS variables for consistent styling */}
        <div className="absolute inset-0 backdrop-blur-md border-b" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }} />
        {/* Title and buttons - hide logo text on very thin screens */}
        <div className="w-full py-2 relative z-10">
          <div className="container mx-auto max-w-4xl flex justify-between items-center px-4">
            <WeWriteLogo
              size="md"
              styled={true}
              clickable={true}
              showText={!isStackedHeader}
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
              <ModeToggle />
              {!isAuthenticated ? (
                <>
                  <AuthButton
                    type="login"
                    variant="secondary"
                    size="sm"
                    device="mobile"
                  />
                  <AuthButton
                    type="register"
                    variant="default"
                    size="sm"
                    device="mobile"
                  >
                    Sign Up
                  </AuthButton>
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

      </div>

      {/* Floating Financial Header */}
      <LoggedOutFinancialHeader />

      <main className={`${isMobileView ? 'pt-32' : 'pt-28'}`}>
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



        {/* Hero Card Section */}
        <section className="py-4 md:py-6 pt-6 md:pt-8">
          <div className="container mx-auto px-6 max-w-4xl space-y-8">

            {/* Write Share Earn Card */}
            <HeroCard
              fadeInClass={fadeInClass}
              platformOptions={[]} // Remove swappable text
              platformIndex={0}
              handlePlatformClick={() => {}} // No-op
              platformRef={React.createRef()}
            />

          </div>
        </section>

        {/* How It Works Section */}
        <HowItWorksSection />

        {/* Features Carousel */}
        <FeaturesCarousel />

        {/* Activity Carousel */}
        <section className="py-8 md:py-12">
          <div className="text-center mb-8 px-6">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Recent Activity</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              See what the WeWrite community is creating and editing right now
            </p>
          </div>
          <div className="w-full overflow-visible">
            <ActivityCarousel limit={30} />
          </div>
        </section>

        {/* Trending Pages Carousel */}
        <section className="py-8 md:py-12">
          <div className="text-center mb-8 px-6">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Trending Pages</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Discover the most popular content on WeWrite
            </p>
          </div>
          <div className="w-full overflow-visible">
            <SimpleTrendingCarousel limit={20} />
          </div>
        </section>

        {/* Bottom spacing for footer visibility */}
        <div className="pb-32 md:pb-24"></div>

      </main>

      {/* Global Footer */}
      <SiteFooter />

      {/* Floating Action Button for logged out users */}
      {!isAuthenticated && (
        <button
          onClick={() => setIsNoteDrawerOpen(true)}
          className="fixed right-4 bottom-6 z-50 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
          aria-label="Start writing"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Note Drawer for logged out users */}
      <LoggedOutNoteDrawer
        isOpen={isNoteDrawerOpen}
        onClose={() => setIsNoteDrawerOpen(false)}
      />
    </div>
    </LandingColorProvider>
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