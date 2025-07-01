"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '../ui/button';

interface ProgressiveHeroTextProps {
  fadeInClass: string;
  platformOptions: string[];
  platformIndex: number;
  handlePlatformClick: () => void;
  platformRef: React.RefObject<HTMLSpanElement>;
  analytics: any;
}

/**
 * ProgressiveHeroText Component
 *
 * Implements progressive loading animation for hero text:
 * 1. First: Load and animate in "Write," "Share," and "Earn." text elements
 * 2. Then: Load remaining hero card elements with spring animations
 */
export default function ProgressiveHeroText({
  fadeInClass,
  platformOptions,
  platformIndex,
  handlePlatformClick,
  platformRef,
  analytics
}: ProgressiveHeroTextProps) {
  const [showMainText, setShowMainText] = useState(false);
  const [showSecondaryContent, setShowSecondaryContent] = useState(false);

  useEffect(() => {
    // Start main text animation immediately
    setShowMainText(true);

    // Show secondary content after main text animation
    const timer = setTimeout(() => {
      setShowSecondaryContent(true);
    }, 800); // Delay for progressive loading

    return () => clearTimeout(timer);
  }, []);

  // Spring animation variants
  const springVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 0.95
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 25,
        duration: 0.6
      }
    }
  };

  const staggeredVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1
      }
    }
  };

  const wordVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 0.8
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 20,
        duration: 0.5
      }
    }
  };

  return (
    <>
      {/* Progressive Hero Title */}
      <motion.div
        initial="hidden"
        animate={showMainText ? "visible" : "hidden"}
        variants={staggeredVariants}
        className="mb-6"
      >
        <motion.h1 className="text-4xl font-bold flex flex-wrap justify-center gap-2">
          <motion.span variants={wordVariants} className="text-primary">
            Write,
          </motion.span>
          <motion.span variants={wordVariants} className="text-primary">
            share,
          </motion.span>
          <motion.span variants={wordVariants} className="text-primary">
            earn.
          </motion.span>
        </motion.h1>
      </motion.div>

      {/* Secondary Content with Spring Animation */}
      <motion.div
        initial="hidden"
        animate={showSecondaryContent ? "visible" : "hidden"}
        variants={springVariants}
        className="space-y-6"
      >
        {/* Description Text */}
        <motion.div variants={springVariants}>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 text-justify">
            WeWrite is a free speech platform and social wiki where every page is a{' '}
            <span
              className="cursor-pointer relative group"
              onClick={(e) => {
                e.preventDefault();
                // Track fundraiser text click in Google Analytics
                analytics.trackInteractionEvent('LINK_CLICKED', {
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
            </span>
            . Write a hundred pages, you've just written a hundred{' '}
            <span
              ref={platformRef}
              onClick={handlePlatformClick}
              className="cursor-pointer hover:text-primary transition-colors select-none"
              title="Click me!"
            >
              {platformOptions[platformIndex]}
            </span>.
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div variants={springVariants} className="flex flex-col gap-4">
          <Button
            size="lg"
            variant="outline"
            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white w-full"
            asChild
          >
            <Link href="/auth/login">Sign In</Link>
          </Button>
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white w-full" asChild>
            <Link href="/auth/register">Create Account</Link>
          </Button>
        </motion.div>
      </motion.div>
    </>
  );
}