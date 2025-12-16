"use client";

import React from 'react';
import { useParams, notFound } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import LandingPage from '../../components/landing/LandingPage';
import { getVertical, isValidVertical } from '../../constants/landing-verticals';

/**
 * Vertical-specific landing page
 *
 * Displays the landing page with customized hero text for specific verticals:
 * - /welcome/writers
 * - /welcome/journalism
 * - /welcome/homeschool
 * - /welcome/politics
 * - /welcome/research
 */
export default function VerticalWelcomePage() {
  const { isLoading } = useAuth();
  const params = useParams();
  const verticalSlug = params.vertical as string;

  // Validate the vertical slug
  if (!isValidVertical(verticalSlug)) {
    notFound();
  }

  const vertical = getVertical(verticalSlug);

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
  return (
    <LandingPage
      showReferralSection={true}
      heroTitle={vertical.heroTitle}
      heroSubtitle={vertical.heroSubtitle}
    />
  );
}
