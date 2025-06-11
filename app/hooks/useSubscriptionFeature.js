"use client";

import { useState } from 'react';
import { useFeatureFlag } from "../utils/feature-flags";

/**
 * Hook to check if the subscription feature is enabled
 * @param {string} userEmail - The current user's email
 * @param {string} userId - The current user's UID
 * @returns {Object} - { isEnabled, isLoading, showComingSoonModal, setShowComingSoonModal }
 */
export function useSubscriptionFeature(userEmail, userId) {
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);

  // Use the reactive feature flag hook for real-time updates
  const isEnabled = useFeatureFlag('payments', userEmail, userId);

  return {
    isEnabled,
    isLoading: false, // The useFeatureFlag hook handles loading internally
    showComingSoonModal,
    setShowComingSoonModal
  };
}
