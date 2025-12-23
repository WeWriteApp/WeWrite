"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

/**
 * Tutorial step IDs - ordered sequence for onboarding
 */
export type TutorialStepId =
  | 'write-page'      // Encourage user to write their first page
  | 'link-pages'      // Show how to link to other pages
  | 'fill-bio'        // Encourage filling in bio
  | 'setup-subscription' // Set up subscription to support creators
  | 'search';         // Show search functionality

/**
 * Tutorial step configuration
 */
export interface TutorialStep {
  id: TutorialStepId;
  title: string;
  description: string;
  targetSelector?: string; // CSS selector for the element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right';
  actionLabel?: string; // e.g., "Got it", "Next", "Skip"
  skipLabel?: string;
  route?: string; // Route where this step should appear
}

/**
 * Tutorial steps configuration
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'write-page',
    title: 'Create Your First Page',
    description: 'Start by writing something! Tap the + button below to create a new page. Every page you write can earn you money when readers support it.',
    position: 'left',
    actionLabel: 'Create a Page',
    route: '/home',
  },
  {
    id: 'link-pages',
    title: 'Link to Other Pages',
    description: 'Select text and tap the link button to connect to other pages. Links help readers discover more content and build connections across WeWrite.',
    position: 'bottom',
    actionLabel: 'Got it',
    skipLabel: 'Skip',
  },
  {
    id: 'fill-bio',
    title: 'Tell Us About Yourself',
    description: 'Add a bio to your profile so other users can learn about you. A good bio helps you connect with readers who share your interests.',
    position: 'bottom',
    actionLabel: 'Edit Profile',
    skipLabel: 'Later',
    route: '/settings/profile',
  },
  {
    id: 'setup-subscription',
    title: 'Support Creators',
    description: 'Subscribe to allocate monthly funds to the pages you love. Creators earn based on how much support their pages receive.',
    position: 'bottom',
    actionLabel: 'View Plans',
    skipLabel: 'Maybe Later',
    route: '/settings/fund-account',
  },
  {
    id: 'search',
    title: 'Discover Content',
    description: 'Use the search to find pages on any topic. Explore trending content or search for specific subjects you\'re interested in.',
    position: 'bottom',
    actionLabel: 'Try Search',
    skipLabel: 'Got it',
    route: '/search',
  },
];

/**
 * Tutorial progress state
 */
interface TutorialProgress {
  completedSteps: TutorialStepId[];
  skippedSteps: TutorialStepId[];
  currentStepIndex: number;
  isActive: boolean;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Tutorial context type
 */
interface TutorialContextType {
  // State
  progress: TutorialProgress;
  currentStep: TutorialStep | null;
  isActive: boolean;

  // Actions
  startTutorial: () => void;
  resetTutorial: () => void;
  completeStep: (stepId: TutorialStepId) => void;
  skipStep: (stepId: TutorialStepId) => void;
  goToStep: (stepIndex: number) => void;
  endTutorial: () => void;

  // Helpers
  isStepCompleted: (stepId: TutorialStepId) => boolean;
  isStepSkipped: (stepId: TutorialStepId) => boolean;
  getStepIndex: (stepId: TutorialStepId) => number;
  shouldShowStep: (stepId: TutorialStepId) => boolean;
}

const STORAGE_KEY = 'wewrite-tutorial-progress';

const defaultProgress: TutorialProgress = {
  completedSteps: [],
  skippedSteps: [],
  currentStepIndex: 0,
  isActive: false,
};

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

/**
 * Tutorial Provider Component
 */
export function TutorialProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<TutorialProgress>(defaultProgress);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load progress from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setProgress(parsed);
      }
    } catch (error) {
      console.error('Failed to load tutorial progress:', error);
    }
    setIsHydrated(true);
  }, []);

  // Save progress to localStorage when it changes
  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {
      console.error('Failed to save tutorial progress:', error);
    }
  }, [progress, isHydrated]);

  // Get current step based on index
  const currentStep = progress.isActive && progress.currentStepIndex < TUTORIAL_STEPS.length
    ? TUTORIAL_STEPS[progress.currentStepIndex]
    : null;

  // Start the tutorial from the beginning
  const startTutorial = useCallback(() => {
    setProgress({
      completedSteps: [],
      skippedSteps: [],
      currentStepIndex: 0,
      isActive: true,
      startedAt: new Date().toISOString(),
    });
  }, []);

  // Reset tutorial (clear all progress)
  const resetTutorial = useCallback(() => {
    setProgress(defaultProgress);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Complete a step and move to next
  const completeStep = useCallback((stepId: TutorialStepId) => {
    setProgress(prev => {
      const newCompletedSteps = prev.completedSteps.includes(stepId)
        ? prev.completedSteps
        : [...prev.completedSteps, stepId];

      const nextIndex = prev.currentStepIndex + 1;
      const isComplete = nextIndex >= TUTORIAL_STEPS.length;

      return {
        ...prev,
        completedSteps: newCompletedSteps,
        currentStepIndex: isComplete ? prev.currentStepIndex : nextIndex,
        isActive: !isComplete,
        completedAt: isComplete ? new Date().toISOString() : undefined,
      };
    });
  }, []);

  // Skip a step and move to next
  const skipStep = useCallback((stepId: TutorialStepId) => {
    setProgress(prev => {
      const newSkippedSteps = prev.skippedSteps.includes(stepId)
        ? prev.skippedSteps
        : [...prev.skippedSteps, stepId];

      const nextIndex = prev.currentStepIndex + 1;
      const isComplete = nextIndex >= TUTORIAL_STEPS.length;

      return {
        ...prev,
        skippedSteps: newSkippedSteps,
        currentStepIndex: isComplete ? prev.currentStepIndex : nextIndex,
        isActive: !isComplete,
        completedAt: isComplete ? new Date().toISOString() : undefined,
      };
    });
  }, []);

  // Go to a specific step
  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < TUTORIAL_STEPS.length) {
      setProgress(prev => ({
        ...prev,
        currentStepIndex: stepIndex,
        isActive: true,
      }));
    }
  }, []);

  // End tutorial early
  const endTutorial = useCallback(() => {
    setProgress(prev => ({
      ...prev,
      isActive: false,
      completedAt: new Date().toISOString(),
    }));
  }, []);

  // Helper: check if step is completed
  const isStepCompleted = useCallback((stepId: TutorialStepId) => {
    return progress.completedSteps.includes(stepId);
  }, [progress.completedSteps]);

  // Helper: check if step is skipped
  const isStepSkipped = useCallback((stepId: TutorialStepId) => {
    return progress.skippedSteps.includes(stepId);
  }, [progress.skippedSteps]);

  // Helper: get step index
  const getStepIndex = useCallback((stepId: TutorialStepId) => {
    return TUTORIAL_STEPS.findIndex(s => s.id === stepId);
  }, []);

  // Helper: should show this step (is current and on correct route)
  const shouldShowStep = useCallback((stepId: TutorialStepId) => {
    if (!progress.isActive) return false;
    if (currentStep?.id !== stepId) return false;
    return true;
  }, [progress.isActive, currentStep]);

  const value: TutorialContextType = {
    progress,
    currentStep,
    isActive: progress.isActive,
    startTutorial,
    resetTutorial,
    completeStep,
    skipStep,
    goToStep,
    endTutorial,
    isStepCompleted,
    isStepSkipped,
    getStepIndex,
    shouldShowStep,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

/**
 * Hook to use tutorial context
 */
export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}

/**
 * Hook to check if a specific tutorial step should be shown
 * Returns null if step shouldn't show, or step config if it should
 */
export function useTutorialStep(stepId: TutorialStepId): TutorialStep | null {
  const { shouldShowStep } = useTutorial();
  const step = TUTORIAL_STEPS.find(s => s.id === stepId);

  if (!step || !shouldShowStep(stepId)) {
    return null;
  }

  return step;
}
