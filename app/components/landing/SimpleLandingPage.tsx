"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '../../components/ui/button';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Separator } from "../../components/ui/separator";

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  }
};

const SimpleLandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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
      image: "/images/feature-fundraiser.png"
    },
    {
      title: "No ads",
      description: "Since each page on WeWrite is a fundraiser, we won't need to sell ad space to companies.",
      status: "done",
      image: "/images/feature-no-ads.png"
    },
    {
      title: "Multiple View Modes",
      description: "Choose between Wrapped, Default, and Spaced reading modes to customize your reading experience.",
      status: "done",
      image: "/images/feature-1.png"
    }
  ];

  const comingSoonFeatures = [
    {
      title: "Recurring donations",
      description: "Support your favorite writers with monthly donations that help them continue creating great content.",
      status: "coming-soon",
      image: "/images/feature-donations.png"
    },
    {
      title: "Collaborative pages",
      description: "Work together with others on shared documents with real-time collaboration features.",
      status: "coming-soon",
      image: "/images/feature-collaboration.png"
    },
    {
      title: "Map view",
      description: "Visualize your content and connections in an interactive map interface.",
      status: "coming-soon",
      image: "/images/feature-map-view.png"
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
        className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-200 ${
          isScrolled
            ? 'py-3 bg-background/80 backdrop-blur-xl shadow-md'
            : 'py-4 bg-background/70 backdrop-blur-lg border-b border-border/10'
        }`}
      >
        <div className="container mx-auto flex justify-between items-center px-6">
          <div className="flex items-center space-x-6">
            <h1
              className="text-2xl font-bold text-primary cursor-pointer"
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
              className="text-xl font-bold text-primary cursor-pointer"
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
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-6">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <motion.div
                className="flex-1 text-center lg:text-left"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeIn}
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
              </motion.div>

              <motion.div
                className="flex-1"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
              >
                <div className="relative w-full max-w-md mx-auto">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-emerald-500/30 rounded-lg z-10"></div>
                  <Image
                    src="/images/hero-image.png"
                    alt="WeWrite App Interface"
                    width={600}
                    height={600}
                    className="relative z-0 rounded-lg shadow-xl"
                    priority
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 md:py-20">
          <div className="container mx-auto px-6">
            <motion.div
              className="text-center mb-16"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Available Features</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Discover what makes WeWrite special
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {builtFeatures.map((feature, index) => (
                <motion.div
                  key={index}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeIn}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full border border-border overflow-hidden">
                    {feature.image && (
                      <div className="relative w-full h-48 overflow-hidden">
                        <Image
                          src={feature.image}
                          alt={feature.title}
                          width={600}
                          height={300}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle>{feature.title}</CardTitle>
                        {getStatusBadge(feature.status)}
                      </div>
                      <CardDescription>
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Coming Soon Section */}
        <section id="coming-soon" className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-6">
            <motion.div
              className="text-center mb-16"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Coming Soon</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Features we're working on for future releases
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {comingSoonFeatures.map((feature, index) => (
                <motion.div
                  key={index}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeIn}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full border border-border overflow-hidden">
                    {feature.image && (
                      <div className="relative w-full h-48 overflow-hidden">
                        <Image
                          src={feature.image}
                          alt={feature.title}
                          width={600}
                          height={300}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle>{feature.title}</CardTitle>
                        {getStatusBadge(feature.status)}
                      </div>
                      <CardDescription>
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" asChild className="w-full">
                        <Link href="/subscription">
                          Become a Supporter
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Supporters Section */}
        <section id="supporters" className="py-16 md:py-20 bg-background">
          <div className="container mx-auto px-6">
            <motion.div
              className="text-center mb-16"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Supporters</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Special thanks to those who have a subscription for WeWrite while we're still in beta, working on the rest of the functionality. <Link href="/zRNwhNgIEfLFo050nyAT" className="text-primary hover:underline">Read our Roadmap here</Link>.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeIn}
                transition={{ delay: 0.1 }}
              >
                <Card className="h-full border border-border">
                  <CardHeader>
                    <CardTitle>Tier 1 Supporters</CardTitle>
                    <CardDescription>
                      Our entry-level supporters who help keep the lights on.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>

              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeIn}
                transition={{ delay: 0.2 }}
              >
                <Card className="h-full border border-border">
                  <CardHeader>
                    <CardTitle>Tier 2 & 3 Supporters</CardTitle>
                    <CardDescription>
                      Dedicated supporters who enable us to build new features faster.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>

              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeIn}
                transition={{ delay: 0.3 }}
              >
                <Card className="h-full border border-border">
                  <CardHeader>
                    <CardTitle>Tier 4 Supporters</CardTitle>
                    <CardDescription>
                      Our most dedicated supporters who make WeWrite possible.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            </div>

            <motion.div
              className="text-center mt-12"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
            >
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
                <Link href="/subscription">Become a Supporter</Link>
              </Button>
            </motion.div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="py-16 md:py-20">
          <div className="container mx-auto px-6">
            <motion.div
              className="text-center mb-16"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">About WeWrite</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Built with modern technologies for the best user experience
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {techStack.map((tech, index) => (
                <motion.div
                  key={index}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeIn}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle>{tech.title}</CardTitle>
                      <CardDescription>
                        {tech.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </div>

            <motion.div
              className="text-center mt-20"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to get started?</h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
                Join thousands of writers who are already using WeWrite to create and share content.
              </p>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
                <Link href="/auth/register">Create Your Free Account</Link>
              </Button>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 px-6 bg-background">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-sm text-muted-foreground">© 2025 WeWrite. All rights reserved.</p>
            </div>
            <div className="flex space-x-6">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                Terms of Service
              </Link>
              <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default SimpleLandingPage;
