"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { useTutorial, TutorialStepId, TUTORIAL_STEPS } from '../../contexts/TutorialContext';
import { cn } from '../../lib/utils';
import { useRouter } from 'next/navigation';

interface GuidedTooltipProps {
  stepId: TutorialStepId;
  children: React.ReactNode;
  /** Override the default position */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Custom class for the wrapper */
  className?: string;
  /** Alignment within the position */
  align?: 'start' | 'center' | 'end';
}

/**
 * GuidedTooltip Component
 *
 * Wraps a UI element and shows a tutorial tooltip when the step is active.
 * The tooltip appears attached to the wrapped element with an arrow pointing to it.
 */
export function GuidedTooltip({
  stepId,
  children,
  position: positionOverride,
  className,
  align = 'center',
}: GuidedTooltipProps) {
  const router = useRouter();
  const { shouldShowStep, completeStep, skipStep, currentStep, progress, endTutorial } = useTutorial();
  const [isVisible, setIsVisible] = useState(false);

  const step = TUTORIAL_STEPS.find(s => s.id === stepId);
  const position = positionOverride || step?.position || 'bottom';
  const showTooltip = shouldShowStep(stepId);

  // Delay showing tooltip slightly for smooth animation
  useEffect(() => {
    if (showTooltip) {
      const timer = setTimeout(() => setIsVisible(true), 300);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [showTooltip]);

  if (!step) return <>{children}</>;

  const handleAction = () => {
    // If step has a route, navigate there
    if (step.route && step.route !== window.location.pathname) {
      router.push(step.route);
    }
    completeStep(stepId);
  };

  const handleSkip = () => {
    skipStep(stepId);
  };

  const handleEndTutorial = () => {
    endTutorial();
  };

  // Calculate step progress
  const currentIndex = progress.currentStepIndex;
  const totalSteps = TUTORIAL_STEPS.length;

  // Position classes for the tooltip
  const positionClasses = {
    top: 'bottom-full mb-3',
    bottom: 'top-full mt-3',
    left: 'right-full mr-3',
    right: 'left-full ml-3',
  };

  // Alignment classes
  const alignClasses = {
    top: {
      start: 'left-0',
      center: 'left-1/2 -translate-x-1/2',
      end: 'right-0',
    },
    bottom: {
      start: 'left-0',
      center: 'left-1/2 -translate-x-1/2',
      end: 'right-0',
    },
    left: {
      start: 'top-0',
      center: 'top-1/2 -translate-y-1/2',
      end: 'bottom-0',
    },
    right: {
      start: 'top-0',
      center: 'top-1/2 -translate-y-1/2',
      end: 'bottom-0',
    },
  };

  // Arrow classes
  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-[var(--card-bg)]',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-[var(--card-bg)]',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-[var(--card-bg)]',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-[var(--card-bg)]',
  };

  return (
    <div className={cn('relative inline-block', className)}>
      {/* Highlight ring around target element when tooltip is showing */}
      <div
        className={cn(
          'transition-all duration-300',
          isVisible && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg'
        )}
      >
        {children}
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'absolute z-[100] w-72 sm:w-80',
              positionClasses[position],
              alignClasses[position][align]
            )}
          >
            {/* Tooltip card */}
            <div className="wewrite-card p-4 shadow-lg border border-primary/20 bg-[var(--card-bg)]">
              {/* Header with step indicator */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Icon name="Lightbulb" size={14} className="text-primary-foreground" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Step {currentIndex + 1} of {totalSteps}
                  </span>
                </div>
                <button
                  onClick={handleEndTutorial}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close tutorial"
                >
                  <Icon name="X" size={16} />
                </button>
              </div>

              {/* Progress pie chart */}
              <div className="flex items-center justify-center mb-3">
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                    {/* Background circle */}
                    <path
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-muted-foreground/30"
                    />
                    {/* Progress circle */}
                    <path
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray={`${((currentIndex + 1) / totalSteps) * 100}, 100`}
                      className="text-primary"
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Center text */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-medium text-foreground">
                      {currentIndex + 1}/{totalSteps}
                    </span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <h3 className="font-semibold text-base mb-1">{step.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{step.description}</p>

              {/* Actions */}
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="text-muted-foreground"
                >
                  {step.skipLabel || 'Skip'}
                </Button>
                <Button
                  size="sm"
                  onClick={handleAction}
                  className="gap-1"
                >
                  {step.actionLabel || 'Next'}
                  <Icon name="ArrowRight" size={14} />
                </Button>
              </div>
            </div>

            {/* Arrow */}
            <div
              className={cn(
                'absolute w-0 h-0 border-8',
                arrowClasses[position]
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Standalone tutorial tooltip that can be positioned anywhere
 * Useful for floating action buttons or elements that can't be wrapped
 */
export function TutorialSpotlight({ stepId }: { stepId: TutorialStepId }) {
  const router = useRouter();
  const { shouldShowStep, completeStep, skipStep, progress, endTutorial } = useTutorial();
  const step = TUTORIAL_STEPS.find(s => s.id === stepId);

  if (!step || !shouldShowStep(stepId)) {
    return null;
  }

  const handleAction = () => {
    // For the first step, click the FAB to create a new page
    if (stepId === 'write-page') {
      const fab = document.getElementById('floating-action-button');
      if (fab) {
        fab.click();
      }
      // Don't complete the step until the page is actually created
      return;
    }

    if (step.route && step.route !== window.location.pathname) {
      router.push(step.route);
    }
    completeStep(stepId);
  };

  const handleSkip = () => {
    skipStep(stepId);
  };

  const currentIndex = progress.currentStepIndex;
  const totalSteps = TUTORIAL_STEPS.length;

  // For the first step (write-page), position above the FAB with arrow pointing down
  const isFirstStep = stepId === 'write-page';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: isFirstStep ? -20 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: isFirstStep ? -20 : 20 }}
        className={cn(
          "fixed z-[100]",
          isFirstStep
            ? "bottom-20 right-4 w-72 sm:w-80"  // Position above FAB
            : "bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80"
        )}
      >
        <div className="wewrite-card p-4 shadow-lg border border-primary/20 relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <Icon name="Lightbulb" size={14} className="text-primary-foreground" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                Tip {currentIndex + 1} of {totalSteps}
              </span>
            </div>
            <button
              onClick={endTutorial}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close tutorial"
            >
              <Icon name="X" size={16} />
            </button>
          </div>

          {/* Progress pie chart */}
          <div className="flex items-center justify-center mb-3">
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                {/* Background circle */}
                <path
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted-foreground/30"
                />
                {/* Progress circle */}
                <path
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={`${((currentIndex + 1) / totalSteps) * 100}, 100`}
                  className="text-primary"
                  strokeLinecap="round"
                />
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-medium text-foreground">
                  {currentIndex + 1}/{totalSteps}
                </span>
              </div>
            </div>
          </div>

          {/* Content */}
          <h3 className="font-semibold text-base mb-1">{step.title}</h3>
          <p className="text-sm text-muted-foreground mb-4">{step.description}</p>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              {step.skipLabel || 'Skip'}
            </Button>
            <Button
              size="sm"
              onClick={handleAction}
              className="gap-1"
            >
              {step.actionLabel || 'Next'}
              <Icon name="ArrowRight" size={14} />
            </Button>
          </div>

          {/* Arrow pointing down to FAB (only for first step) */}
          {isFirstStep && (
            <div className="absolute -bottom-3 right-5 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-[hsl(var(--card))]" />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default GuidedTooltip;
