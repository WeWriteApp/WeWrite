"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { Platform } from '@/app/utils/capacitor';
import { Check, Smartphone, Bell, Lock, ArrowRight, Sparkles } from 'lucide-react';
import Image from 'next/image';

interface MobileOnboardingProps {
  platform: Platform;
  onComplete: () => void;
  isPreview?: boolean;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iosContent?: React.ReactNode;
  androidContent?: React.ReactNode;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to WeWrite',
    description: 'Your creative writing companion. Write, share, and connect with other writers.',
    icon: <Sparkles className="h-12 w-12 text-primary" />,
  },
  {
    id: 'features',
    title: 'Write Beautifully',
    description: 'Create stunning pages with our distraction-free editor. Add backgrounds, customize fonts, and express yourself.',
    icon: <Smartphone className="h-12 w-12 text-primary" />,
  },
  {
    id: 'notifications',
    title: 'Stay Connected',
    description: 'Get notified when someone comments on your work or follows you. Enable notifications to never miss a moment.',
    icon: <Bell className="h-12 w-12 text-primary" />,
  },
  {
    id: 'privacy',
    title: 'Your Privacy Matters',
    description: 'Control who sees your work. Keep pages private, share with followers, or publish to the world.',
    icon: <Lock className="h-12 w-12 text-primary" />,
  },
];

export default function MobileOnboarding({ platform, onComplete, isPreview = false }: MobileOnboardingProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    if (!isPreview) {
      // Mark onboarding as complete in localStorage
      localStorage.setItem('wewrite_mobile_onboarding_complete', 'true');
      onComplete();
    } else {
      // In preview mode, just reset to first step
      setCurrentStep(0);
    }
  };

  const currentStepData = onboardingSteps[currentStep];
  const isLastStep = currentStep === onboardingSteps.length - 1;
  const isIOS = platform === 'ios';
  const isAndroid = platform === 'android';

  return (
    <div className={`min-h-screen flex flex-col bg-background ${isPreview ? 'rounded-xl overflow-hidden' : ''}`}>
      {/* Platform indicator for preview mode */}
      {isPreview && (
        <div className={`px-4 py-2 text-center text-xs font-medium ${isIOS ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}`}>
          {isIOS ? 'iOS Preview' : 'Android Preview'}
        </div>
      )}

      {/* Progress dots */}
      <div className="flex justify-center gap-2 pt-8 pb-4">
        {onboardingSteps.map((_, index) => (
          <div
            key={index}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentStep
                ? 'w-8 bg-primary'
                : index < currentStep
                ? 'w-2 bg-primary/50'
                : 'w-2 bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {/* Icon */}
        <div className={`mb-8 p-6 rounded-full ${isIOS ? 'bg-blue-500/10' : 'bg-green-500/10'}`}>
          {currentStepData.icon}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold mb-4">{currentStepData.title}</h1>

        {/* Description */}
        <p className="text-muted-foreground text-lg mb-8 max-w-sm">
          {currentStepData.description}
        </p>

        {/* Platform-specific content */}
        {currentStepData.id === 'notifications' && (
          <div className={`p-4 rounded-xl mb-6 ${isIOS ? 'bg-blue-500/5' : 'bg-green-500/5'}`}>
            <p className="text-sm text-muted-foreground">
              {isIOS
                ? "We'll ask for notification permission when you're ready."
                : 'Tap the notification icon in your status bar to manage alerts.'}
            </p>
          </div>
        )}

        {currentStepData.id === 'privacy' && (
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            <span className="px-3 py-1.5 rounded-full bg-muted text-sm">Private</span>
            <span className="px-3 py-1.5 rounded-full bg-muted text-sm">Followers Only</span>
            <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">Public</span>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className={`px-6 pb-8 space-y-3 ${isIOS ? 'pb-10' : ''}`}>
        <Button
          onClick={handleNext}
          size="lg"
          className="w-full gap-2"
        >
          {isLastStep ? (
            <>
              Get Started
              <Check className="h-4 w-4" />
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        {!isLastStep && (
          <Button
            variant="ghost"
            onClick={handleSkip}
            size="lg"
            className="w-full text-muted-foreground"
          >
            Skip
          </Button>
        )}
      </div>
    </div>
  );
}
