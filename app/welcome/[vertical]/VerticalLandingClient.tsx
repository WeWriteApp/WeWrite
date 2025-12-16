"use client";

import React from 'react';
import { useAuth } from '../../providers/AuthProvider';
import LandingPage from '../../components/landing/LandingPage';

interface VerticalLandingClientProps {
  heroTitle: string;
  heroSubtitle: string;
}

/**
 * Client component wrapper for vertical landing pages
 *
 * Handles auth state and renders the LandingPage component with
 * vertical-specific hero text. The LandingPage component is shared
 * across all verticals - only the hero text changes.
 */
export default function VerticalLandingClient({ heroTitle, heroSubtitle }: VerticalLandingClientProps) {
  const { isLoading } = useAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-8 w-32 bg-muted rounded-md" />
        </div>
      </div>
    );
  }

  // Show landing page with vertical-specific hero text
  // isPreviewMode=true enables the preview banner and shows Sign In/Sign Up buttons for authenticated users
  return (
    <LandingPage
      showReferralSection={true}
      isPreviewMode={true}
      heroTitle={heroTitle}
      heroSubtitle={heroSubtitle}
    />
  );
}
