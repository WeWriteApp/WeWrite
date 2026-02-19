'use client';

import { Icon } from '@/components/ui/Icon';
import { Button } from '../../ui/button';
import { useTutorial, TUTORIAL_STEPS, TutorialStepId } from '../../../contexts/TutorialContext';
import { useAuth } from '../../../providers/AuthProvider';
import { useRouter } from 'next/navigation';

export default function OnboardingChecklistContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { progress, isStepCompleted, isStepSkipped, startTutorial, completeStep, goToStep } = useTutorial();

  const handleStepAction = (stepId: TutorialStepId, stepIndex: number) => {
    const step = TUTORIAL_STEPS[stepIndex];

    if (stepId === 'write-page') {
      goToStep(stepIndex);
      router.push('/home');
      return;
    }

    if (stepId === 'fill-bio' && user?.displayName) {
      completeStep(stepId);
      router.push(`/u/${user.displayName}?tab=bio`);
      return;
    }

    if (step.route) {
      completeStep(stepId);
      router.push(step.route);
    } else {
      completeStep(stepId);
    }
  };

  const completedCount = progress.completedSteps.length;
  const totalSteps = TUTORIAL_STEPS.length;

  return (
    <div className="px-4 pb-6">
      {/* Progress summary */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          {completedCount} of {totalSteps} completed
        </p>
        <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${(completedCount / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="divide-y divide-border">
        {TUTORIAL_STEPS.map((step, index) => {
          const completed = isStepCompleted(step.id);
          const skipped = isStepSkipped(step.id);

          return (
            <button
              key={step.id}
              onClick={() => !completed ? handleStepAction(step.id, index) : undefined}
              disabled={completed}
              className="w-full flex items-start gap-3 py-3 text-left hover:bg-muted/50 transition-colors disabled:opacity-60 disabled:cursor-default px-1"
            >
              {/* Status icon */}
              <div className="mt-0.5 flex-shrink-0">
                {completed ? (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Icon name="Check" size={12} className="text-primary-foreground" />
                  </div>
                ) : skipped ? (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                    <Icon name="Minus" size={12} className="text-muted-foreground" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <span className={`font-medium text-sm ${completed ? 'line-through text-muted-foreground' : ''}`}>
                  {step.title}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
              </div>

              {/* Action indicator */}
              {!completed && (
                <Icon name="ChevronRight" size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Restart button */}
      {completedCount > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={startTutorial}
            className="text-muted-foreground w-full"
          >
            <Icon name="RotateCcw" size={14} className="mr-2" />
            Restart checklist
          </Button>
        </div>
      )}
    </div>
  );
}
