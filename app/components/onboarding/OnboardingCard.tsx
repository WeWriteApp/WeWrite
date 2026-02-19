"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { useTutorial, TUTORIAL_STEPS } from '../../contexts/TutorialContext';
import { useFeatureFlags } from '../../contexts/FeatureFlagContext';
import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from 'next/navigation';

/**
 * OnboardingCard Component
 *
 * Inline onboarding section that sits at the top of the home feed.
 * Shows the current tutorial step with progress, description, and action buttons.
 */
export function OnboardingCard() {
  const router = useRouter();
  const { user } = useAuth();
  const { isActive, currentStep, progress, completeStep, skipStep, endTutorial, startTutorial } = useTutorial();
  const { isEnabled } = useFeatureFlags();
  const [isDismissing, setIsDismissing] = useState(false);

  const flagEnabled = isEnabled('onboarding_tutorial');
  const show = flagEnabled && isActive && !!currentStep && !isDismissing;

  const currentIndex = progress.currentStepIndex;
  const totalSteps = TUTORIAL_STEPS.length;
  const progressPercent = ((currentIndex + 1) / totalSteps) * 100;
  const isLastStep = currentIndex === totalSteps - 1;

  const handleDismiss = () => {
    setIsDismissing(true);
    // Let animation play, then update tutorial state
    setTimeout(() => {
      endTutorial();
      setIsDismissing(false);
    }, 250);
  };

  const handleAction = () => {
    if (!currentStep) return;

    // For write-page, click the FAB
    if (currentStep.id === 'write-page') {
      const fab = document.getElementById('floating-action-button');
      if (fab) {
        fab.click();
      }
      return;
    }

    // fill-bio → go to user's profile page on bio tab
    if (currentStep.id === 'fill-bio' && user?.displayName) {
      router.push(`/u/${user.displayName}?tab=bio`);
      completeStep(currentStep.id);
      return;
    }

    // Navigate to the step's route if it has one
    if (currentStep.route) {
      router.push(currentStep.route);
    }
    completeStep(currentStep.id);
  };

  const handleSkip = () => {
    if (!currentStep) return;
    skipStep(currentStep.id);
  };

  return (
    <AnimatePresence>
      {show && currentStep && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97, height: 0 }}
          animate={{ opacity: 1, scale: 1, height: 'auto' }}
          exit={{ opacity: 0, scale: 0.95, height: 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          <div className="px-4">
            <div className="wewrite-card p-4 border border-primary/20">
              {/* Top row: label + dismiss */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Icon name="Lightbulb" size={14} className="text-primary-foreground" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Getting started — step {currentIndex + 1} of {totalSteps}
                  </span>
                </div>
                <button
                  onClick={handleDismiss}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label="Dismiss onboarding"
                >
                  <Icon name="X" size={16} />
                </button>
              </div>

              {/* Progress bar */}
              <div className="h-1 bg-muted rounded-full mb-3 overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>

              {/* Content — only this part cross-fades between steps */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <h3 className="font-semibold text-base mb-1">{currentStep.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{currentStep.description}</p>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={isLastStep ? startTutorial : handleSkip}
                      className="text-muted-foreground"
                    >
                      {isLastStep ? 'Restart checklist' : (currentStep.skipLabel || 'Skip')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAction}
                      className="gap-1"
                    >
                      {currentStep.actionLabel || 'Next'}
                      <Icon name="ArrowRight" size={14} />
                    </Button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default OnboardingCard;
