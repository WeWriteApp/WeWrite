"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Hero } from './Hero';
import { FeatureSection } from './FeatureSection';
import { FeatureCarousel } from './FeatureCarousel';
import { DeveloperSection } from './DeveloperSection';
import { motion } from 'framer-motion';
import { Separator } from "../../components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "../../components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "../../components/ui/navigation-menu";

const sectionVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll function for anchor links
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();

    // Extract the id from the href
    const targetId = href.replace('#', '');
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
      // Get the header height to offset the scroll position
      const headerHeight = 80; // Approximate header height in pixels
      const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - headerHeight;

      // Smooth scroll to the target position
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });

      // Update URL without scrolling
      window.history.pushState(null, '', href);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Header */}
      <header
        className={`fixed top-0 left-0 right-0 w-full header-border-transition z-50 transition-all duration-200 hidden md:block ${
          isScrolled
            ? 'py-3 bg-background/80 backdrop-blur-xl shadow-md'
            : 'border-visible py-4 bg-background/70 backdrop-blur-lg'
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

            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <a
                    href="#features"
                    onClick={(e) => scrollToSection(e, '#features')}
                    className={navigationMenuTriggerStyle()}
                  >
                    Features
                  </a>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <a
                    href="#about"
                    onClick={(e) => scrollToSection(e, '#about')}
                    className={navigationMenuTriggerStyle()}
                  >
                    About
                  </a>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
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
        {/* Top Header with Logo and Buttons */}
        <div className={`w-full header-border-transition transition-all duration-200 ${
          isScrolled
            ? 'py-2 bg-background/90 backdrop-blur-xl shadow-sm'
            : 'border-visible py-3 bg-background/80 backdrop-blur-lg'
          }`}
        >
          <div className="container mx-auto flex justify-between items-center px-4">
            <div className="flex items-center">
              <h1
                className="text-xl font-bold text-primary cursor-pointer"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                WeWrite
              </h1>
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="secondary" size="sm" asChild>
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
                <Link href="/auth/register">Create Account</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Subheader with Scrollable Links */}
        <div className="w-full bg-background/70 backdrop-blur-md border-b border-border/10 py-2 overflow-x-auto scrollbar-hide">
          <div className="flex items-center justify-center space-x-8 px-4 min-w-max mx-auto">
            <a
              href="#features"
              onClick={(e) => scrollToSection(e, '#features')}
              className="text-sm font-medium whitespace-nowrap transition-colors hover:text-primary"
            >
              Features
            </a>
            <a
              href="#about"
              onClick={(e) => scrollToSection(e, '#about')}
              className="text-sm font-medium whitespace-nowrap transition-colors hover:text-primary"
            >
              About
            </a>
          </div>
        </div>
      </div>

      <main className="pt-32 md:pt-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={sectionVariants}
        >
          <Hero />
        </motion.div>

        <motion.section
          id="features"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={sectionVariants}
        >
          <FeatureCarousel />
          <FeatureSection />
        </motion.section>

        <motion.section
          id="about"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={sectionVariants}
        >
          <DeveloperSection />
        </motion.section>
      </main>

      <motion.footer
        className="border-theme-medium border-t-only py-8 px-6 bg-background"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={sectionVariants}
      >
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-sm text-muted-foreground"> 2025 WeWrite. All rights reserved.</p>
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
      </motion.footer>
    </div>
  );
};

export default LandingPage;