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
import { WeWriteLogo } from '../ui/WeWriteLogo';
import { ModeToggle } from '../ui/mode-toggle';
import SiteFooter from '../layout/SiteFooter';
import LoggedOutNoteDrawer from './LoggedOutNoteDrawer';
import { Icon } from '@/components/ui/Icon';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { LANDING_VERTICALS, getVerticalSlugs } from '../../constants/landing-verticals';

interface LandingPageProps {
  showReferralSection?: boolean;
  // When true, shows the landing page as a preview for authenticated users
  // This shows Sign In/Sign Up buttons and adds a preview banner
  isPreviewMode?: boolean;
  // Optional vertical-specific hero text overrides
  heroTitle?: string;
  heroSubtitle?: string;
}

interface ReferralStats {
  totalReferrals: number;
  recentReferrals: { username: string; joinedAt: string }[];
}

const LandingPage = ({ showReferralSection = false, isPreviewMode = false, heroTitle, heroSubtitle }: LandingPageProps) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);
  const [isStackedHeader, setIsStackedHeader] = useState(false);
  const [isNoteDrawerOpen, setIsNoteDrawerOpen] = useState(false);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [referralStatsLoading, setReferralStatsLoading] = useState(false);

  // Referrer info from URL ?ref= parameter
  const [referrerInfo, setReferrerInfo] = useState<{
    uid: string;
    username: string | null;
    displayName: string | null;
  } | null>(null);
  const [referrerLoading, setReferrerLoading] = useState(false);

  const { setTheme, theme } = useTheme();
  const [session, setUser] = useState<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Authentication state
  const { user, isAuthenticated } = useAuth();

  // Determine if we're showing as a preview (authenticated user viewing landing page)
  const showAsPreview = isPreviewMode && isAuthenticated;

  // Analytics hook for tracking
  const analytics = useWeWriteAnalytics();

  // Animation classes
  const fadeInClass = "animate-fadeIn";

  // Resolve referrer info when ?ref= parameter is present
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (!refCode || isAuthenticated) {
      // Don't show "invited by" for already authenticated users
      setReferrerLoading(false);
      return;
    }

    const resolveReferrer = async () => {
      setReferrerLoading(true);
      try {
        const response = await fetch(`/api/referral/resolve?ref=${encodeURIComponent(refCode)}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setReferrerInfo(result.data);
          }
        }
      } catch (error) {
        console.error('[Landing] Error resolving referrer:', error);
      } finally {
        setReferrerLoading(false);
      }
    };

    resolveReferrer();
  }, [searchParams, isAuthenticated]);

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

  // Load referral stats when showing referral section for authenticated users
  useEffect(() => {
    if (showReferralSection && isAuthenticated && user?.uid) {
      setReferralStatsLoading(true);
      fetch(`/api/user/referral-stats?userId=${user.uid}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setReferralStats(data);
          }
        })
        .catch(err => console.error('Failed to load referral stats:', err))
        .finally(() => setReferralStatsLoading(false));
    }
  }, [showReferralSection, isAuthenticated, user?.uid]);

  // Get current pathname for vertical-aware referral links
  const pathname = usePathname();

  // Generate and copy invite link (vertical-aware)
  const copyInviteLink = async () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    // Use the current pathname to generate the referral link
    // This ensures that /welcome/writers copies /welcome/writers?ref=xxx
    // Use username if available, fallback to UID for backwards compatibility
    const refCode = user?.username || user?.uid || '';
    const inviteLink = `${baseUrl}${pathname}?ref=${refCode}`;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteLinkCopied(true);
      setTimeout(() => setInviteLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };




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

      {/* Preview Mode Banner - shown for authenticated users viewing the landing page as a preview */}
      {/* This is a fixed banner that integrates with the landing page's own header system */}
      {showAsPreview && (
        <div
          className="fixed left-0 right-0 z-[60] bg-primary text-primary-foreground"
          style={{
            top: 0,
            height: '48px',
          }}
        >
          <div className="container mx-auto max-w-4xl px-4 py-3 h-full flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/invite')}
              className="flex items-center gap-1 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Icon name="ArrowLeft" size={16} />
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyInviteLink}
              className="flex items-center gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              {inviteLinkCopied ? (
                <>
                  <Icon name="Check" size={16} />
                  Copied!
                </>
              ) : (
                <>
                  <Icon name="Copy" size={16} />
                  Copy referral link
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Desktop Navigation */}
      <header
        className={`fixed left-0 right-0 w-full z-50 transition-all duration-300 ${isMobileView ? 'hidden' : 'block'}`}
        style={{ top: showAsPreview ? '48px' : 'var(--banner-stack-height, 0px)' }}
      >
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
            {/* In preview mode OR when not authenticated, always show Sign In/Sign Up buttons */}
            {(!isAuthenticated || showAsPreview) ? (
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
      <div
        className={`${isMobileView ? 'block' : 'hidden'} fixed left-0 right-0 z-50 flex flex-col w-full`}
        style={{ top: showAsPreview ? '48px' : 'var(--banner-stack-height, 0px)' }}
      >
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
              {/* In preview mode OR when not authenticated, always show Sign In/Sign Up buttons */}
              {(!isAuthenticated || showAsPreview) ? (
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

      <main className="pt-16" style={{ paddingTop: showAsPreview ? 'calc(64px + 48px)' : undefined }}>
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
              heroTitle={heroTitle}
              heroSubtitle={heroSubtitle}
            />

            {/* "Invited by" banner for users arriving via referral link, or in preview mode to show what recipients will see */}
            {((!isAuthenticated && searchParams.get('ref')) || showAsPreview) && (
              <div className="wewrite-card p-4 md:p-5 bg-primary/5 border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Icon name="Heart" size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      You've been invited by{' '}
                      <Link
                        href={`/u/${showAsPreview ? (user?.username || user?.uid || '') : (referrerInfo?.username || searchParams.get('ref'))}`}
                        className="text-primary hover:underline font-semibold"
                      >
                        @{showAsPreview ? (user?.username || user?.displayName || 'you') : (referrerInfo?.username || referrerInfo?.displayName || searchParams.get('ref'))}
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Referral Section for Authenticated Users */}
            {/* Hide referral section in preview mode - the preview banner handles copy link functionality */}
            {showReferralSection && isAuthenticated && !showAsPreview && (
              <div className="wewrite-card p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Icon name="UserPlus" size={24} className="text-primary" />
                  <h3 className="text-xl font-semibold">Invite Friends to WeWrite</h3>
                </div>
                <p className="text-muted-foreground mb-6">
                  Share your invite link and track who joins using your referral.
                </p>

                {/* Copy Invite Link */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <div className="flex-1 bg-muted rounded-lg px-4 py-3 font-mono text-sm truncate">
                    {typeof window !== 'undefined' ? `${window.location.origin}${pathname}?ref=${user?.username || user?.uid || ''}` : 'Loading...'}
                  </div>
                  <Button
                    onClick={copyInviteLink}
                    variant={inviteLinkCopied ? 'default' : 'outline'}
                    className="flex items-center gap-2 min-w-[140px]"
                  >
                    {inviteLinkCopied ? (
                      <>
                        <Icon name="Check" size={16} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Icon name="Copy" size={16} />
                        Copy Link
                      </>
                    )}
                  </Button>
                </div>

                {/* Referral Stats */}
                <div className="border-t border-border pt-6">
                  <h4 className="text-sm font-medium text-muted-foreground mb-4">Your Referrals</h4>
                  {referralStatsLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Icon name="Loader" size={16} />
                      Loading...
                    </div>
                  ) : referralStats && referralStats.totalReferrals > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary/10 rounded-lg px-4 py-2">
                          <span className="text-2xl font-bold text-primary">{referralStats.totalReferrals}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {referralStats.totalReferrals === 1 ? 'person joined' : 'people joined'}
                          </span>
                        </div>
                      </div>
                      {referralStats.recentReferrals.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">Recent signups:</p>
                          <div className="flex flex-wrap gap-2">
                            {referralStats.recentReferrals.map((r, i) => (
                              <Badge key={i} variant="secondary">
                                @{r.username}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No referrals yet. Share your link to start inviting friends!
                    </p>
                  )}
                </div>
              </div>
            )}

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
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              See what people are writing about right now
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
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              The pages getting the most attention this week
            </p>
          </div>
          <div className="w-full overflow-visible">
            <SimpleTrendingCarousel limit={20} />
          </div>
        </section>

        {/* About WeWrite Section - SEO Content */}
        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">About WeWrite</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                A new kind of writing platform where your words have value
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="wewrite-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Icon name="PenLine" size={24} className="text-primary flex-shrink-0" />
                  <h3 className="text-xl font-semibold">Write About Anything</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  WeWrite is a free speech writing platform where you can share your ideas, stories, and knowledge with the world.
                  Whether you're writing fiction, non-fiction, tutorials, opinion pieces, or creative content,
                  WeWrite gives you the tools and audience you need to succeed.
                </p>
              </div>

              <div className="wewrite-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Icon name="DollarSign" size={24} className="text-primary flex-shrink-0" />
                  <h3 className="text-xl font-semibold">Earn From Your Content</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Every page on WeWrite is a fundraiser. Readers can allocate their monthly subscription to the pages they love most.
                  At the end of each month, creators get paid based on how much support their pages received.
                  No ads, no algorithms hiding your content—just direct support from your readers.
                </p>
              </div>

              <div className="wewrite-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Icon name="Users" size={24} className="text-primary flex-shrink-0" />
                  <h3 className="text-xl font-semibold">Build Your Audience</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Connect with readers who appreciate your work. Build a following, engage with your community,
                  and grow your presence as a writer. Our trending pages and activity feeds help new writers get discovered
                  while established creators can deepen their connection with supporters.
                </p>
              </div>

              <div className="wewrite-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Icon name="Heart" size={24} className="text-primary flex-shrink-0" />
                  <h3 className="text-xl font-semibold">Join Our Community</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  WeWrite is more than a platform—it's a community of writers and readers who believe in the value of quality content.
                  Join thousands of creators who are already sharing their work and earning from their writing.
                  Start your journey today and see what your words are worth.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">FAQ</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Frequently asked questions
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              <Accordion type="single" collapsible className="space-y-4">
                {/* FAQ Item: App Installation */}
                <AccordionItem value="app-install" className="wewrite-card border-none">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Icon name="Smartphone" size={20} className="text-primary flex-shrink-0" />
                      <span className="font-medium text-left">How do I install WeWrite as an app?</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4">
                    <p className="text-muted-foreground leading-relaxed">
                      WeWrite isn't on the App Store yet, but you can still use it like a native app! On your phone or tablet,
                      open WeWrite in your browser and tap <strong>"Add to Home Screen"</strong> (iOS) or <strong>"Install App"</strong> (Android).
                      This creates an icon on your home screen that opens WeWrite in full-screen mode—just like a regular app.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ Item: Bootstrapped / No Investors */}
                <AccordionItem value="bootstrapped" className="wewrite-card border-none">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Icon name="Building2" size={20} className="text-primary flex-shrink-0" />
                      <span className="font-medium text-left">Is WeWrite backed by investors?</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4">
                    <p className="text-muted-foreground leading-relaxed">
                      No—and that's intentional. WeWrite is 100% founder-bootstrapped with zero outside investors.
                      This means we're not beholden to shareholders demanding aggressive growth at all costs.
                      Instead, we're focused on building a sustainable platform that prioritizes revenue stability
                      and long-term value for our community of writers and readers. Our success is measured by
                      the success of our creators, not by quarterly earnings reports.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </section>

        {/* Browse by Community Section - shows all vertical landing pages */}
        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">WeWrite for Your Community</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                See how WeWrite works for different types of creators
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {getVerticalSlugs().map((slug) => {
                const vertical = LANDING_VERTICALS[slug];
                return (
                  <Link
                    key={slug}
                    href={`/welcome/${slug}`}
                    className="wewrite-card p-5 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                        {vertical.name}
                      </h3>
                      <Icon name="ExternalLink" size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {vertical.heroTitle}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Ready to Start CTA Card - only show for logged out users */}
        {!isAuthenticated && (
          <section className="py-8 md:py-12">
            <div className="container mx-auto px-6 max-w-4xl">
              <div className="wewrite-card p-8 md:p-10 text-center">
                <div className="flex justify-center mb-4">
                  <Icon name="Rocket" size={40} className="text-primary" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to Start Writing & Earning?</h2>
                <p className="text-lg text-muted-foreground mb-6 max-w-xl mx-auto">
                  Create your free account and publish your first page in minutes.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <AuthButton
                    type="register"
                    size="lg"
                    variant="default"
                    device="bottom_cta"
                  >
                    Get Started Free
                  </AuthButton>
                  <AuthButton
                    type="login"
                    size="lg"
                    variant="outline"
                    device="bottom_cta"
                  >
                    Sign In
                  </AuthButton>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Bottom spacing for footer visibility */}
        <div className="pb-8 md:pb-6"></div>

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
          <Icon name="Plus" size={24} />
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