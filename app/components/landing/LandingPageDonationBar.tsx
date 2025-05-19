"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { ArrowRight } from 'lucide-react';
import { openExternalLinkInNewTab } from '../../utils/pwa-detection';
import '../../styles/pledge-bar-animations.css';
import '../../styles/shimmer-animation.css';

interface LandingPageDonationBarProps {
  isLoggedIn: boolean;
}

const LandingPageDonationBar: React.FC<LandingPageDonationBarProps> = ({ isLoggedIn }) => {
  const [animateEntry, setAnimateEntry] = useState(false);

  // Animate entry after a short delay
  useEffect(() => {
    // If user is logged in, don't show the donation bar
    if (isLoggedIn) {
      return;
    }

    const timer = setTimeout(() => {
      setAnimateEntry(true);
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [isLoggedIn]);

  // If user is logged in, don't show the donation bar
  if (isLoggedIn) {
    return null;
  }

  return (
    <div
      data-donation-bar
      className={`fixed bottom-4 left-0 right-0 z-50 flex justify-center transition-all duration-300 ${
        animateEntry ? 'spring-and-pulse' : ''
      }`}
    >
      <div className="w-full max-w-[500px] mx-auto px-4">
        <div className="bg-background/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow rounded-lg border border-border/40">
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 gap-3">
            <div className="flex-1 mb-0 text-center sm:text-left">
              <p className="text-sm font-normal text-muted-foreground">
                WeWrite is under construction, please consider donating on OpenCollective to help cover engineering costs
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                // Open OpenCollective link in a new tab
                openExternalLinkInNewTab('https://opencollective.com/wewrite-app', 'Landing Page Donation Bar');
              }}
              className="shimmer-button gradient-button donation-bar-button whitespace-nowrap w-full sm:w-auto"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="mx-auto sm:mx-0">Support Us</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPageDonationBar;
