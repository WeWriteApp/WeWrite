"use client";

import { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { Platform } from '@/app/utils/capacitor';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';

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
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to WeWrite',
    description: 'A platform for thought. Capture ideas, share perspectives, and discover what others are thinking.',
    icon: <Icon name="Sparkles" size={48} className="text-primary" />,
  },
  {
    id: 'features',
    title: 'Your Ideas, Connected',
    description: 'Create notes that link to other notes. Build a web of interconnected thoughts and explore how ideas relate.',
    icon: <Icon name="Lightbulb" size={48} className="text-primary" />,
  },
  {
    id: 'social',
    title: 'Think Together',
    description: 'Follow people whose ideas inspire you. See what they\'re thinking and join the conversation.',
    icon: <Icon name="Users" size={48} className="text-primary" />,
  },
  {
    id: 'notifications',
    title: 'Stay in the Loop',
    description: 'Get notified when someone links to your notes or follows you.',
    icon: <Icon name="Bell" size={48} className="text-primary" />,
  },
];

export default function MobileOnboarding({ platform, onComplete, isPreview = false }: MobileOnboardingProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  // Handle Android hardware back button
  useEffect(() => {
    if (isPreview) return;

    const handleBackButton = () => {
      if (currentStep > 0) {
        setCurrentStep(currentStep - 1);
      }
      // Don't exit the app on back press during onboarding - just ignore if on first step
    };

    // Listen for Capacitor back button event
    let backButtonListener: any = null;

    const setupBackButton = async () => {
      try {
        backButtonListener = await App.addListener('backButton', handleBackButton);
      } catch (e) {
        // Not running in Capacitor
      }
    };

    setupBackButton();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, [currentStep, isPreview]);

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = async () => {
    // If on notification step, handle permission request
    if (currentStepData.id === 'notifications') {
      await requestNotificationPermission();
    }

    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    // If skipping notification step, just move on without requesting
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const requestNotificationPermission = async () => {
    if (isPreview) return;

    try {
      const result = await PushNotifications.requestPermissions();
      setNotificationPermission(result.receive);

      if (result.receive === 'granted') {
        // Register for push notifications
        await PushNotifications.register();
      }
    } catch (e) {
      console.log('Push notifications not available:', e);
    }
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
  const isFirstStep = currentStep === 0;
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
        {/* Back button - show on all steps except first */}
        {!isFirstStep && (
          <Button
            variant="outline"
            onClick={handleBack}
            size="lg"
            className="w-full gap-2"
          >
            <Icon name="ArrowLeft" size={16} />
            Back
          </Button>
        )}

        {/* Notification step has special buttons */}
        {currentStepData.id === 'notifications' ? (
          <>
            <Button
              onClick={handleNext}
              size="lg"
              className="w-full gap-2"
            >
              Enable Notifications
              <Icon name="Bell" size={16} />
            </Button>
            <Button
              variant="ghost"
              onClick={handleSkip}
              size="lg"
              className="w-full text-muted-foreground"
            >
              Maybe Later
            </Button>
          </>
        ) : (
          <Button
            onClick={handleNext}
            size="lg"
            className="w-full gap-2"
          >
            {isLastStep ? (
              <>
                Get Started
                <Icon name="Check" size={16} />
              </>
            ) : (
              <>
                Continue
                <Icon name="ArrowRight" size={16} />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
