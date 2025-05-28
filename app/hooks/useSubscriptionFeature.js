"use client";

import { useState } from 'react';
import { useFeatureFlag } from "../utils/feature-flags";

/**
 * Hook to check if the subscription feature is enabled
 * @param {string} userEmail - The current user's email
 * @returns {Object} - { isEnabled, isLoading, showComingSoonModal, setShowComingSoonModal }
 */
export function useSubscriptionFeature(userEmail) {
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);

  // Use the reactive feature flag hook for real-time updates
  const isEnabled = useFeatureFlag('payments', userEmail);

  return {
    isEnabled,
    isLoading: false, // The useFeatureFlag hook handles loading internally
    showComingSoonModal,
    setShowComingSoonModal
  };
}
