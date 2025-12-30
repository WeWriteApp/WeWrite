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
    <div className="space-y-4">
      {/* Status Banner */}
      <div className={cn(
        "wewrite-card flex items-center gap-3",
        isActive ? "bg-primary/10 border-primary/20" : ""
      )}>
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
          isActive ? "bg-primary" : "bg-muted-foreground/20"
        )}>
          <Icon
            name={isActive ? "Play" : "Pause"}
            size={16}
            className={isActive ? "text-primary-foreground" : "text-muted-foreground"}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">
            {isActive
              ? `Step ${progress.currentStepIndex + 1} of ${TUTORIAL_STEPS.length}`
              : "Tutorial Inactive"
            }
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {isActive ? currentStep?.title || 'Unknown' : "Not started"}
          </p>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => {
            startTutorial();
            router.push('/home');
          }}
          size="sm"
          className="gap-1.5 flex-1"
        >
          <Icon name="Play" size={14} />
          {isActive ? 'Restart' : 'Start'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={resetTutorial}
          className="gap-1.5"
        >
          <Icon name="RotateCcw" size={14} />
          Reset
        </Button>
      </div>

      {/* Progress Summary */}
      <div className="wewrite-card">
        <div className="grid grid-cols-4 gap-2 text-center mobile-grid-2">
          <div>
            <div className="text-lg font-bold text-primary">{progress.completedSteps.length}</div>
            <div className="text-xs text-muted-foreground">Done</div>
          </div>
          <div>
            <div className="text-lg font-bold text-yellow-500">{progress.skippedSteps.length}</div>
            <div className="text-xs text-muted-foreground">Skipped</div>
          </div>
          <div>
            <div className="text-lg font-bold text-muted-foreground">
              {TUTORIAL_STEPS.length - progress.completedSteps.length - progress.skippedSteps.length}
            </div>
            <div className="text-xs text-muted-foreground">Left</div>
          </div>
          <div>
            <div className="text-lg font-bold">
              {Math.round(((progress.completedSteps.length + progress.skippedSteps.length) / TUTORIAL_STEPS.length) * 100)}%
            </div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>
      </div>

      {/* Tutorial Steps */}
      <div className="space-y-2">
        <h2 className="font-semibold text-sm">Tutorial Steps</h2>

        {TUTORIAL_STEPS.map((step, index) => {
          const status = getStepStatus(step.id, index);
          const isCurrent = isActive && index === progress.currentStepIndex;

          return (
            <div
              key={step.id}
              className={cn(
                "wewrite-card transition-all",
                isCurrent && "ring-2 ring-primary"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Step number */}
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium",
                  status === 'completed' ? "bg-green-500 text-white" :
                  status === 'skipped' ? "bg-yellow-500 text-white" :
                  isCurrent ? "bg-primary text-primary-foreground" :
                  "bg-muted text-muted-foreground"
                )}>
                  {status === 'completed' ? (
                    <Icon name="Check" size={12} />
                  ) : status === 'skipped' ? (
                    <Icon name="ArrowRight" size={12} />
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{step.title}</h3>
                    {getStatusBadge(status)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                </div>

                {/* Actions */}
                {isActive && (
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => goToStep(index)}
                      disabled={isCurrent}
                      className="h-7 w-7 p-0"
                    >
                      <Icon name="Target" size={12} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => completeStep(step.id)}
                      disabled={isStepCompleted(step.id)}
                      className="h-7 w-7 p-0 text-green-600"
                    >
                      <Icon name="Check" size={12} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Debug Info */}
      <details>
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
          Debug Information
        </summary>
        <pre className="mt-2 p-2 bg-muted rounded-lg text-xs overflow-auto">
          {JSON.stringify(progress, null, 2)}
        </pre>
      </details>
    </div>
  );
}
