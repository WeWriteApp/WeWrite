"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '../../components/ui/button';
import { Check, ArrowRight, Flame, Loader, User } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Separator } from "../../components/ui/separator";
import { SupporterIcon } from '../SupporterIcon';
import Header from '../Header';
import { PagePreviewCard } from './PagePreviewCard';
import LandingTrendingSection from './LandingTrendingSection';
import { ImageCarousel } from './ImageCarousel';

// Import mock page content (in a real implementation, this would be fetched from Firebase)
const pageContents = {
  "RFsPq1tbcOMtljwHyIMT": {
    "title": "Every Page is a Fundraiser",
    "body": "On WeWrite, every page you create is a potential source of income. The Pledge bar at the bottom of each page allows readers to support your work directly.\n\nUnlike traditional platforms that rely on advertising or paywalls, WeWrite empowers creators to earn from their content through direct reader support. This creates a more sustainable ecosystem for quality content.\n\nWhen readers appreciate your work, they can contribute to your page through one-time or recurring donations. This direct connection between creators and supporters fosters a community of engaged readers who value your contributions.",
    "isPublic": true
  },
  "aJFMqTEKuNEHvOrYE9c2": {
    "title": "No Ads",
    "body": "WeWrite is committed to providing a clean, distraction-free reading and writing experience. We don't show ads anywhere on the platform.\n\nInstead of relying on advertising revenue, we've built a sustainable model based on direct creator support. This means you can focus on what matters: creating and consuming great content.\n\nNo tracking pixels, no sponsored content, no intrusive banners—just pure content. This creates a better experience for everyone and aligns our incentives with what truly matters: quality writing and engaged readers.",
    "isPublic": true
  },
  "ou1LPmpynpoirLrv99fq": {
    "title": "Multiple View Modes",
    "body": "WeWrite offers different reading experiences to suit your preferences. Choose between Wrapped, Default, and Spaced modes to customize how content appears.\n\nWrapped mode provides a more compact reading experience, ideal for longer articles or when you want to see more content at once.\n\nDefault mode balances readability with content density, offering a clean layout that works well for most content types.\n\nSpaced mode increases the whitespace around paragraphs, making it easier to focus on individual sections—perfect for deep reading or complex topics.",
    "isPublic": true
  },
  "o71h6Lg1wjGSC1pYaKXz": {
    "title": "Recurring Donations",
    "body": "Support your favorite writers consistently with recurring monthly donations. This feature helps creators establish a predictable income stream while giving supporters a hassle-free way to contribute.\n\nAs a supporter, you can set up automatic monthly contributions to the writers you value most. This ongoing support helps creators focus on producing quality content rather than constantly seeking new funding sources.\n\nFor writers, recurring donations provide financial stability and a deeper connection with your most dedicated readers. You'll be able to see your monthly recurring revenue and plan your content strategy accordingly.",
    "isPublic": true
  },
  "4jw8FdMJHGofMc4G2QTw": {
    "title": "Collaborative Pages",
    "body": "Work together with others on shared documents with WeWrite's collaborative features. Multiple contributors can edit and expand on ideas together, creating richer, more diverse content.\n\nCollaboration happens in real-time, allowing for immediate feedback and iteration. This makes WeWrite perfect for team projects, community knowledge bases, or any situation where multiple perspectives enhance the final result.\n\nPage owners can invite specific collaborators or open their pages to public contributions, with full control over edit permissions and content approval.",
    "isPublic": true
  },
  "N7Pg3iJ0OQhkpw16MTZW": {
    "title": "Map View",
    "body": "Visualize your content and connections with WeWrite's interactive Map View. This feature transforms your collection of pages into a visual knowledge graph, helping you see relationships between ideas.\n\nMap View makes it easy to navigate complex topics by showing how different pages connect to each other. Discover unexpected relationships between your content or explore how others have linked to your work.\n\nThis visual approach to content organization helps both creators and readers gain new insights and discover content they might otherwise miss in a traditional linear format.",
    "isPublic": true
  },
  "0krXqAU748w43YnWJwE2": {
    "title": "Calendar View",
    "body": "Organize and view your content chronologically with Calendar View. This feature helps you track your writing history and plan future content.\n\nFor writers, Calendar View provides insights into your productivity patterns and helps maintain consistent publishing schedules. See at a glance when you've been most active and identify gaps in your content timeline.\n\nReaders can use Calendar View to discover content based on when it was published, making it easier to follow a writer's journey or find the most recent updates on evolving topics.",
    "isPublic": true
  }
};

// Simple fade-in animation using CSS
const fadeInClass = "animate-fadeIn";

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const heroSectionRef = useRef<HTMLElement>(null);

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

  // Smooth scroll function for anchor links
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const targetId = href.replace('#', '');
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
      const headerHeight = 80; // Approximate header height in pixels
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

  return (
      <div className="min-h-screen bg-background">
      {/* Desktop Header */}
      <header
        className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-200 hidden md:block ${
          isScrolled
            ? 'py-3 bg-background/80 backdrop-blur-xl shadow-md'
            : 'py-4 bg-background/70 backdrop-blur-lg border-b border-border/10'
        }`}
      >
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
                href="#features"
                onClick={(e) => scrollToSection(e, '#features')}
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Features
              </a>
              <a
                href="#coming-soon"
                onClick={(e) => scrollToSection(e, '#coming-soon')}
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Coming Soon
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

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex flex-col w-full">
        <div className={`w-full transition-all duration-200 ${
          isScrolled
            ? 'py-2 bg-background/90 backdrop-blur-xl shadow-sm'
            : 'py-3 bg-background/80 backdrop-blur-lg border-b border-border/10'
          }`}
        >
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

        {/* Mobile Navigation */}
        <div className="w-full bg-background/70 backdrop-blur-md border-b border-border/10 py-2">
          <div className="flex items-center justify-around px-4">
            <a
              href="#features"
              onClick={(e) => scrollToSection(e, '#features')}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Features
            </a>
            <a
              href="#coming-soon"
              onClick={(e) => scrollToSection(e, '#coming-soon')}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Coming Soon
            </a>
            <a
              href="#supporters"
              onClick={(e) => scrollToSection(e, '#supporters')}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Supporters
            </a>
            <a
              href="#about"
              onClick={(e) => scrollToSection(e, '#about')}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              About
            </a>
          </div>
        </div>
      </div>

      <main className="pt-32 md:pt-28">
        {/* Hero Section */}
        <section
          className="py-16 md:py-20 relative overflow-hidden"
          ref={heroSectionRef}
          onMouseMove={(e) => {
            if (heroSectionRef.current) {
              const rect = heroSectionRef.current.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;

              // Calculate rotation (limited to ±5 degrees)
              const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * 5;
              const rotateX = -((e.clientY - centerY) / (rect.height / 2)) * 5;

              setRotation({ x: rotateX, y: rotateY });
            }
          }}
          onMouseLeave={() => setRotation({ x: 0, y: 0 })}
        >
          {/* No background image */}

          <div className="container mx-auto px-6 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div
                className={`flex-1 text-center lg:text-left ${fadeInClass}`}
              >
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                  Write, share, earn.
                </h1>
                <p className="text-xl md:text-2xl text-muted-foreground mb-8">
                  WeWrite is a social wiki where every page is a fundraiser. Write a hundred pages, you've just written a hundred Kickstarters.
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

              <div
                className={`flex-1 ${fadeInClass}`}
                style={{ animationDelay: '0.2s' }}
              >
                <ImageCarousel
                  images={[
                    "/images/landing/hero-image.png",
                    "/images/carousel/image-1.png",
                    "/images/carousel/image-2.png",
                    "/images/carousel/image-3.png"
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Trending Pages Section - Moved to top */}
        <LandingTrendingSection limit={3} />

        {/* Features Section */}
        <section id="features" className="py-16 md:py-20 bg-background">
          <div className="container mx-auto px-6">
            <div className={`text-center mb-16 ${fadeInClass}`}>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Available Features</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Discover what makes WeWrite special
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {builtFeatures.map((feature, index) => (
                <div
                  key={index}
                  className={`${fadeInClass}`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <PagePreviewCard
                    title={feature.title}
                    content={pageContents[feature.pageId]?.body || feature.description}
                    pageId={feature.pageId}
                    status={feature.status as any}
                    maxContentLength={150}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Coming Soon Section - Moved below features */}
        <section id="coming-soon" className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-6">
            <div className={`text-center mb-16 ${fadeInClass}`}>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Coming Soon</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Features we're working on for future releases
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                    status={feature.status as any}
                    maxContentLength={150}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Supporters Section */}
        <section id="supporters" className="py-16 md:py-20 bg-background">
          <div className="container mx-auto px-6">
            <div className={`text-center mb-16 ${fadeInClass}`}>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Supporters</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Special thanks to those who have a subscription for WeWrite while we're still in beta, working on the rest of the functionality. <Link href="/zRNwhNgIEfLFo050nyAT" className="text-primary hover:underline">Read our Roadmap here</Link>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className={`${fadeInClass}`} style={{ animationDelay: '0.1s' }}>
                <Card className="h-full border border-border hover:shadow-lg transition-all duration-200">
                  <CardHeader>
                    <CardTitle>Tier 1 Supporters</CardTitle>
                    <CardDescription>
                      Our entry-level supporters who help keep the lights on.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                        <SupporterIcon tier="tier1" status="active" size="lg" />
                      </div>
                      <p className="text-sm text-center">No supporters yet</p>
                      <p className="text-xs text-center mt-1">Be the first to support at this tier!</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className={`${fadeInClass}`} style={{ animationDelay: '0.2s' }}>
                <Card className="h-full border border-border hover:shadow-lg transition-all duration-200">
                  <CardHeader>
                    <CardTitle>Tier 2 Supporters</CardTitle>
                    <CardDescription>
                      Dedicated supporters who enable us to build new features faster.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                        <SupporterIcon tier="tier2" status="active" size="lg" />
                      </div>
                      <p className="text-sm text-center">No supporters yet</p>
                      <p className="text-xs text-center mt-1">Be the first to support at this tier!</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className={`${fadeInClass}`} style={{ animationDelay: '0.3s' }}>
                <Card className="h-full border border-border hover:shadow-lg transition-all duration-200">
                  <CardHeader>
                    <CardTitle>Tier 3 Supporters</CardTitle>
                    <CardDescription>
                      Our most dedicated supporters who make WeWrite possible.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                        <SupporterIcon tier="tier3" status="active" size="lg" />
                      </div>
                      <p className="text-sm text-center">No supporters yet</p>
                      <p className="text-xs text-center mt-1">Be the first to support at this tier!</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>


          </div>
        </section>

        {/* About Section */}
        <section id="about" className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-6">
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
          <div className="container mx-auto px-6">
            <div className={`text-center ${fadeInClass}`}>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Get Started?</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
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
