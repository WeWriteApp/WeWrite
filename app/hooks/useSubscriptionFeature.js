"use client";

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/database';
import { isAdmin } from '../utils/feature-flags.ts';

/**
 * Hook to check if the subscription feature is enabled
 * @param {string} userEmail - The current user's email
 * @returns {Object} - { isEnabled, isLoading, showComingSoonModal, setShowComingSoonModal }
 */
export function useSubscriptionFeature(userEmail) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);

  useEffect(() => {
    const checkFeatureFlag = async () => {
      try {
        setIsLoading(true);

        // Always check feature flag in Firestore, even for admin users
        const featureFlagsRef = doc(db, 'config', 'featureFlags');
        const featureFlagsDoc = await getDoc(featureFlagsRef);

        if (featureFlagsDoc.exists()) {
          const flagsData = featureFlagsDoc.data();
          const isFeatureEnabled = flagsData.subscription_management === true;
          console.log('Subscription feature flag from database:', isFeatureEnabled);
          setIsEnabled(isFeatureEnabled);
        } else {
          console.log('No feature flags document found, defaulting subscription to disabled');
          // Default to disabled if no document exists
          setIsEnabled(false);
        }
      } catch (error) {
        console.error('Error checking subscription feature flag:', error);
        // Default to disabled on error
        setIsEnabled(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkFeatureFlag();
  }, [userEmail]);

  return {
    isEnabled,
    isLoading,
    showComingSoonModal,
    setShowComingSoonModal
  };
}
