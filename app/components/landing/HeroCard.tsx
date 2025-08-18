"use client";

import React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import Link from 'next/link';
import { useAuth } from '../../providers/AuthProvider';
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { ANALYTICS_EVENTS } from '../../constants/analytics-events';
import ProgressiveHeroText from './ProgressiveHeroText';

interface HeroCardProps {
  fadeInClass: string;
  platformOptions: string[];
  platformIndex: number;
  handlePlatformClick: () => void;
  platformRef: React.RefObject<HTMLSpanElement>;
}

export default function HeroCard({
  fadeInClass,
  platformOptions,
  platformIndex,
  handlePlatformClick,
  platformRef
}: HeroCardProps) {
  const { user } = useAuth();
  const analytics = useWeWriteAnalytics();
  const isAuthenticated = !!user;

  return (
    <Card className="h-full border-theme-medium bg-gradient-to-br from-background via-background to-muted/20">
      <CardContent className="p-8 md:p-12 flex flex-col justify-center min-h-[500px]">
        <div className="text-center max-w-4xl mx-auto">
          {/* Hero Text */}
          <div className={`mb-8 ${fadeInClass}`}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Write, share, earn.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              WeWrite is a free speech platform and social wiki where every page is a{' '}
              <span
                className="cursor-pointer relative group"
                onClick={(e) => {
                  e.preventDefault();
                  // Track fundraiser text click in Google Analytics
                  analytics.trackInteractionEvent(ANALYTICS_EVENTS.LINK_CLICKED, {
                    label: 'Fundraiser text click: scroll to features',
                    link_type: 'text',
                    link_text: 'fundraiser',
                    link_url: '#features'
                  });
                  // Scroll to features section
                  const featuresSection = document.getElementById('features');
                  if (featuresSection) {
                    featuresSection.scrollIntoView({ behavior: 'smooth' });
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
              </span>
              .
            </p>
          </div>

          {/* Action Buttons */}
          <div className={`flex flex-col sm:flex-row justify-center gap-4 ${fadeInClass}`}>
            {!isAuthenticated ? (
              <>
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
                  asChild
                >
                  <Link
                    href="/auth/login"
                    onClick={() => {
                      console.log('🟠 Hero Sign In button clicked');
                      // Track hero sign-in click in analytics
                      analytics.trackInteractionEvent(ANALYTICS_EVENTS.LINK_CLICKED, {
                        label: 'Hero sign-in button',
                        link_type: 'auth',
                        link_text: 'Sign In',
                        link_url: '/auth/login',
                        device: 'hero_card'
                      });
                    }}
                  >
                    Sign In
                  </Link>
                </Button>
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
                  <Link
                    href="/auth/register"
                    onClick={() => {
                      console.log('🟠 Hero Create Account button clicked');
                      // Track hero create account click in analytics
                      analytics.trackInteractionEvent(ANALYTICS_EVENTS.LINK_CLICKED, {
                        label: 'Hero create account button',
                        link_type: 'auth',
                        link_text: 'Create Account',
                        link_url: '/auth/register',
                        device: 'hero_card'
                      });
                    }}
                  >
                    Create Account
                  </Link>
                </Button>
              </>
            ) : (
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white"
                asChild
              >
                <Link href="/new">Create Page</Link>
              </Button>
            )}
          </div>

          {/* Additional info */}
          <div className={`mt-8 text-sm text-muted-foreground ${fadeInClass}`}>
            <p>Join thousands of writers building the future of collaborative content</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
