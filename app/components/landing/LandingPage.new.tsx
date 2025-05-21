"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Check, ArrowRight, Flame, Activity, FileText } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { PagePreviewCard } from './PagePreviewCard';
import { useTheme } from "next-themes";
import { getPageById } from '../../firebase/database';
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { ANALYTICS_EVENTS } from '../../constants/analytics-events';
import { auth } from '../../firebase/config';
import SimpleActivityCarousel from './SimpleActivityCarousel';
import SimpleTrendingCarousel from './SimpleTrendingCarousel';
import HeroSection from './HeroSection';
import LandingPageDonationBar from './LandingPageDonationBar';

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);
  const { setTheme } = useTheme();
  const [pageContents, setPageContents] = useState<Record<string, any>>({});
  const [user, setUser] = useState<any>(null);

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

  // Check if user is logged in
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  // Always set accent color to blue on landing page mount
  useEffect(() => {
    document.body.classList.add('accent-blue');
    document.documentElement.classList.add('accent-blue');
    document.documentElement.style.setProperty('--accent', '#1768FF');
  }, [setTheme]);

  // Features data
  const builtFeatures = [
    {
      title: "Every Page is a Fundraiser",
      description: "On every page, there's a Pledge bar floating at the bottom.",
      status: "in-progress",
      pageId: "RFsPq1tbcOMtljwHyIMT"
    },
    {
      title: "No ads",
      description: "Since each page on WeWrite is a fundraiser, we won't need to sell ad space.",
      status: "done",
      pageId: "aJFMqTEKuNEHvOrYE9c2"
    },
    {
      title: "Multiple View Modes",
      description: "Choose between Wrapped, Default, and Spaced reading modes.",
      status: "done",
      pageId: "ou1LPmpynpoirLrv99fq"
    }
  ];

  const comingSoonFeatures = [
    {
      title: "Recurring donations",
      description: "Support your favorite writers with monthly donations.",
      status: "coming-soon",
      pageId: "o71h6Lg1wjGSC1pYaKXz"
    },
    {
      title: "Collaborative pages",
      description: "Work together with others on shared documents.",
      status: "coming-soon",
      pageId: "4jw8FdMJHGofMc4G2QTw"
    }
  ];

  // Handle platform text click
  const handlePlatformClick = () => {
    if (isAnimatingPlatform) return;
    setIsAnimatingPlatform(true);
    const nextIndex = (platformIndex + 1) % platformOptions.length;
    setPlatformIndex(nextIndex);
    setIsAnimatingPlatform(false);
  };

  // Handle roadmap scroll navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const scrollContainer = document.getElementById('roadmap-scroll-container');
    const scrollLeftBtn = document.getElementById('roadmap-scroll-left');
    const scrollRightBtn = document.getElementById('roadmap-scroll-right');

    if (!scrollContainer || !scrollLeftBtn || !scrollRightBtn) return;

    const updateScrollButtons = () => {
      if (scrollContainer.scrollLeft > 20) {
        scrollLeftBtn.classList.remove('hidden');
      } else {
        scrollLeftBtn.classList.add('hidden');
      }

      const hasMoreContent = scrollContainer.scrollWidth > scrollContainer.clientWidth &&
        scrollContainer.scrollLeft < (scrollContainer.scrollWidth - scrollContainer.clientWidth - 20);
      
      if (hasMoreContent) {
        scrollRightBtn.classList.remove('hidden');
      } else {
        scrollRightBtn.classList.add('hidden');
      }
    };

    scrollLeftBtn.addEventListener('click', () => {
      scrollContainer.scrollBy({ left: -300, behavior: 'smooth' });
    });

    scrollRightBtn.addEventListener('click', () => {
      scrollContainer.scrollBy({ left: 300, behavior: 'smooth' });
    });

    scrollContainer.addEventListener('scroll', updateScrollButtons);
    updateScrollButtons();
    
    return () => {
      scrollContainer.removeEventListener('scroll', updateScrollButtons);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <LandingPageDonationBar isLoggedIn={!!user} />
      
      <main className={`${isMobileView ? 'pt-24' : 'pt-20'}`}>
        <HeroSection
          fadeInClass={fadeInClass}
          platformOptions={platformOptions}
          platformIndex={platformIndex}
          isAnimatingPlatform={isAnimatingPlatform}
          handlePlatformClick={handlePlatformClick}
          platformRef={platformRef}
        />

        <section id="features" className="py-16 md:py-20 bg-background">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className={`text-center mb-16 ${fadeInClass}`}>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-3">
                <FileText className="h-7 w-7" />
                Feature Roadmap
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-4">
                Discover what makes WeWrite special and what's coming next.
              </p>
            </div>

            <div className="relative -mx-4 sm:-mx-6 md:-mx-6 overflow-visible">
              <div className="relative">
                <button
                  id="roadmap-scroll-left"
                  className="md:hidden absolute left-1 top-1/2 -translate-y-1/2 z-20 bg-background/95 hover:bg-background rounded-full p-2 hidden"
                  aria-label="Scroll left"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                
                <button
                  id="roadmap-scroll-right"
                  className="md:hidden absolute right-1 top-1/2 -translate-y-1/2 z-20 bg-background/95 hover:bg-background rounded-full p-2"
                  aria-label="Scroll right"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              
                <div
                  id="roadmap-scroll-container"
                  className="overflow-x-auto pb-6 px-0 md:px-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
                  style={{
                    scrollbarWidth: 'thin',
                    msOverflowStyle: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    scrollSnapType: 'x mandatory',
                    paddingBottom: '20px'
                  }}
                >
                  <div className="flex gap-4 md:gap-6" style={{
                    paddingLeft: '4px',
                    paddingRight: '4px'
                  }}>
                    {/* Coming Soon Column */}
                    <div className="flex-1 min-w-[250px] md:min-w-[300px] scroll-snap-align-start">
                      <div className="bg-gray-300 dark:bg-gray-700 rounded-lg p-4 mb-4 shadow-sm">
                        <h3 className="text-xl font-bold mb-0 text-center text-gray-800 dark:text-white flex items-center justify-center gap-2">
                          Coming Soon
                        </h3>
                      </div>
                    </div>

                    {/* In Progress Column */}
                    <div className="flex-1 min-w-[250px] md:min-w-[300px] scroll-snap-align-start">
                      <div className="bg-amber-300 dark:bg-amber-600 rounded-lg p-4 mb-4 shadow-sm">
                        <h3 className="text-xl font-bold mb-0 text-center text-amber-800 dark:text-white flex items-center justify-center gap-2">
                          In Progress
                        </h3>
                      </div>
                    </div>

                    {/* Available Now Column */}
                    <div className="flex-1 min-w-[250px] md:min-w-[300px] scroll-snap-align-start">
                      <div className="bg-green-300 dark:bg-green-600 rounded-lg p-4 mb-4 shadow-sm">
                        <h3 className="text-xl font-bold mb-0 text-center text-green-800 dark:text-white flex items-center justify-center gap-2">
                          Available Now
                        </h3>
                      </div>
                    </div>
                  </div>
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
