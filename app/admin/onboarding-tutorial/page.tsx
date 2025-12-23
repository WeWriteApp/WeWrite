"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import Link from 'next/link';
import { isAdmin } from '../../utils/isAdmin';
import { useTutorial, TUTORIAL_STEPS, TutorialStepId } from '../../contexts/TutorialContext';
import { cn } from '../../lib/utils';

export default function OnboardingTutorialAdmin() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const {
    progress,
    currentStep,
    isActive,
    startTutorial,
    resetTutorial,
    completeStep,
    skipStep,
    goToStep,
    endTutorial,
    isStepCompleted,
    isStepSkipped,
  } = useTutorial();

  // Check auth
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Icon name="Loader" className="text-primary" />
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    router.push('/');
    return null;
  }

  const getStepStatus = (stepId: TutorialStepId, index: number) => {
    if (isStepCompleted(stepId)) return 'completed';
    if (isStepSkipped(stepId)) return 'skipped';
    if (isActive && index === progress.currentStepIndex) return 'current';
    return 'pending';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-600 dark:text-green-400">Completed</Badge>;
      case 'skipped':
        return <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">Skipped</Badge>;
      case 'current':
        return <Badge className="bg-primary/20 text-primary">Current</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Link href="/admin" className="inline-flex items-center text-primary hover:text-primary/80 mb-4">
            <Icon name="ChevronLeft" size={16} className="mr-1" />
            Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Onboarding Tutorial</h1>
              <p className="text-muted-foreground">
                Test and preview the guided onboarding experience
              </p>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Icon name="BookOpen" size={14} />
              {TUTORIAL_STEPS.length} steps
            </Badge>
          </div>
        </div>

        {/* Status Banner */}
        <div className={cn(
          "flex items-center gap-3 p-4 rounded-xl border mb-6",
          isActive
            ? "bg-primary/10 border-primary/20"
            : "bg-muted border-border"
        )}>
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
            isActive ? "bg-primary" : "bg-muted-foreground/20"
          )}>
            <Icon
              name={isActive ? "Play" : "Pause"}
              size={20}
              className={isActive ? "text-primary-foreground" : "text-muted-foreground"}
            />
          </div>
          <div className="flex-1">
            <p className="font-medium">
              {isActive
                ? `Tutorial Active - Step ${progress.currentStepIndex + 1} of ${TUTORIAL_STEPS.length}`
                : "Tutorial Inactive"
              }
            </p>
            <p className="text-sm text-muted-foreground">
              {isActive
                ? `Currently showing: ${currentStep?.title || 'Unknown'}`
                : "Tutorial has not been started"
              }
            </p>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button
            onClick={() => {
              startTutorial();
              router.push('/home');
            }}
            className="gap-2"
          >
            <Icon name="Play" size={16} />
            {isActive ? 'Restart' : 'Start'}
          </Button>
          <Button
            variant="outline"
            onClick={resetTutorial}
            className="gap-2"
          >
            <Icon name="RotateCcw" size={16} />
            Reset
          </Button>
        </div>

        {/* Tutorial Steps */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold mb-3">Tutorial Steps</h2>

          {TUTORIAL_STEPS.map((step, index) => {
            const status = getStepStatus(step.id, index);
            const isCurrent = isActive && index === progress.currentStepIndex;

            return (
              <div
                key={step.id}
                className={cn(
                  "wewrite-card p-4 transition-all",
                  isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Step number */}
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium",
                    status === 'completed' ? "bg-green-500 text-white" :
                    status === 'skipped' ? "bg-yellow-500 text-white" :
                    isCurrent ? "bg-primary text-primary-foreground" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {status === 'completed' ? (
                      <Icon name="Check" size={16} />
                    ) : status === 'skipped' ? (
                      <Icon name="ArrowRight" size={16} />
                    ) : (
                      index + 1
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{step.title}</h3>
                      {getStatusBadge(status)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {step.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {step.route && (
                        <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded">
                          <Icon name="MapPin" size={12} />
                          {step.route}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded">
                        <Icon name="ArrowUp" size={12} />
                        {step.position || 'bottom'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    {isActive && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => goToStep(index)}
                          disabled={isCurrent}
                        >
                          <Icon name="Target" size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => completeStep(step.id)}
                          disabled={isStepCompleted(step.id)}
                          className="text-green-600"
                        >
                          <Icon name="Check" size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => skipStep(step.id)}
                          disabled={isStepSkipped(step.id)}
                          className="text-yellow-600"
                        >
                          <Icon name="FastForward" size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Summary */}
        <div className="mt-6 wewrite-card p-4">
          <h3 className="font-medium mb-3">Progress Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{progress.completedSteps.length}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-500">{progress.skippedSteps.length}</div>
              <div className="text-xs text-muted-foreground">Skipped</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-muted-foreground">
                {TUTORIAL_STEPS.length - progress.completedSteps.length - progress.skippedSteps.length}
              </div>
              <div className="text-xs text-muted-foreground">Remaining</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {Math.round(((progress.completedSteps.length + progress.skippedSteps.length) / TUTORIAL_STEPS.length) * 100)}%
              </div>
              <div className="text-xs text-muted-foreground">Progress</div>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <details className="mt-6">
          <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
            Debug Information
          </summary>
          <pre className="mt-2 p-4 bg-muted rounded-lg text-xs overflow-auto">
            {JSON.stringify(progress, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
