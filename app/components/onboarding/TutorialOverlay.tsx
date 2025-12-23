"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { TutorialSpotlight } from './GuidedTooltip';
import { useTutorial } from '../../contexts/TutorialContext';

/**
 * TutorialOverlay Component
 *
 * Renders the active tutorial tooltip based on current route and step.
 * Place this component once in your layout to enable tutorial tooltips.
 */
export function TutorialOverlay() {
  const pathname = usePathname();
  const { isActive, currentStep } = useTutorial();

  // Don't render anything if tutorial is not active
  if (!isActive || !currentStep) {
    return null;
  }

  // Check if current step should show on this route
  // If step has a specific route, only show on that route
  // If no route specified, show on any page
  const stepRoute = currentStep.route;

  // Handle home page routes (both / and /home should work)
  const isHomePage = pathname === '/' || pathname === '/home';
  const stepIsForHome = stepRoute === '/' || stepRoute === '/home';

  const shouldShowOnCurrentRoute =
    !stepRoute ||  // No route specified = show on any page
    pathname === stepRoute ||  // Exact match
    pathname.startsWith(stepRoute + '/') ||  // Nested route
    (isHomePage && stepIsForHome);  // Handle home variations

  if (!shouldShowOnCurrentRoute) {
    return null;
  }

  // Render the spotlight tooltip for the current step
  return <TutorialSpotlight stepId={currentStep.id} />;
}

export default TutorialOverlay;
