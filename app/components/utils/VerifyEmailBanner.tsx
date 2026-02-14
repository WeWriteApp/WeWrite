"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { useAuth } from '../../providers/AuthProvider';
import { useBanner } from '../../providers/BannerProvider';
import { getAnalyticsService } from "../../utils/analytics-service";
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from '../../constants/analytics-events';
import { auth } from '../../firebase/config';
import { Emails } from '../../utils/urlConfig';

const STORAGE_KEYS = {
  EMAIL_BANNER_DISMISSED: 'wewrite_email_banner_dismissed',
  EMAIL_BANNER_DISMISSED_TIMESTAMP: 'wewrite_email_banner_dismissed_timestamp',
  EMAIL_DONT_REMIND: 'wewrite_email_dont_remind'
};

export default function VerifyEmailBanner() {
  const { user } = useAuth();
  const { showEmailBanner, setEmailBannerDismissed } = useBanner();
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);

  if (!showEmailBanner && !isCollapsing) return null;

  const handleDismissWithAnimation = (action: 'dont_remind' | 'later') => {
    setIsCollapsing(true);

    // Track in analytics
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: EVENT_CATEGORIES.EMAIL_VERIFICATION,
        action: ANALYTICS_EVENTS.EMAIL_BANNER_ACTION,
        label: action === 'dont_remind' ? 'Dont_Remind' : 'Later'
      });
    } catch (error) {
      console.error('Error tracking email banner action:', error);
    }

    // Start collapse animation, then dismiss after animation completes
    setTimeout(() => {
      if (action === 'dont_remind') {
        localStorage.setItem(STORAGE_KEYS.EMAIL_DONT_REMIND, 'true');
      } else {
        localStorage.setItem(STORAGE_KEYS.EMAIL_BANNER_DISMISSED, 'true');
        localStorage.setItem(STORAGE_KEYS.EMAIL_BANNER_DISMISSED_TIMESTAMP, Date.now().toString());
      }
      setEmailBannerDismissed();
      setIsCollapsing(false);
    }, 300); // Match animation duration
  };

  const handleLater = () => handleDismissWithAnimation('later');

  const handleShowHelp = () => {
    // Track analytics
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: EVENT_CATEGORIES.EMAIL_VERIFICATION,
        action: ANALYTICS_EVENTS.EMAIL_BANNER_ACTION,
        label: 'Help_Clicked'
      });
    } catch (error) {
      console.error('Error tracking help click:', error);
    }

    setShowHelpModal(true);
  };

  const handleResendEmail = async () => {
    if (isResending || resendCooldown > 0) return;

    setIsResending(true);

    try {
      // Track in analytics
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: EVENT_CATEGORIES.EMAIL_VERIFICATION,
        action: ANALYTICS_EVENTS.EMAIL_BANNER_ACTION,
        label: 'Resend_Email'
      });

      if (auth?.currentUser && user) {
        // Get fresh ID token for API call
        const idToken = await auth.currentUser.getIdToken(true);
        
        // Send via our custom Resend API
        const response = await fetch('/api/email/send-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            userId: user.uid,
            username: user.username,
            idToken,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send verification email');
        }
        
        // Increment attempts and set cooldown
        const newAttempts = resendAttempts + 1;
        setResendAttempts(newAttempts);

        // Progressive cooldown: 10s, 60s, 2min, 5min
        const cooldowns = [10, 60, 120, 300];
        const cooldownTime = cooldowns[Math.min(newAttempts - 1, cooldowns.length - 1)];

        setResendCooldown(cooldownTime);

        // Start cooldown timer
        const timer = setInterval(() => {
          setResendCooldown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // Show success feedback
        console.log('Verification email sent successfully via Resend');
      } else {
        console.warn('No authenticated user; cannot resend verification email');
      }
    } catch (error) {
      console.error('Error resending verification email:', error);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="relative mx-4 mt-2 mb-2 lg:hidden" data-banner="email-verification">
      <div
        className={`wewrite-card px-4 py-3 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          isCollapsing ? 'max-h-0 py-0 opacity-0 transform -translate-y-4 scale-95' : 'max-h-32 opacity-100 transform translate-y-0 scale-100'
        }`}
      >
        <div className="flex items-center space-x-2 mb-2">
          <Icon name="Mail" size={16} className="text-primary" />
          <span className="text-sm font-medium text-foreground">Please verify your email address</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-9 text-xs text-foreground"
            onClick={handleLater}
          >
            Later
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-9 text-xs"
            onClick={handleShowHelp}
          >
            How?
          </Button>
        </div>
      </div>

      {/* Help Modal */}
      <EmailVerificationHelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        onResendEmail={handleResendEmail}
        isResending={isResending}
        resendCooldown={resendCooldown}
      />
    </div>
  );
}

// Email Verification Help Modal Component
function EmailVerificationHelpModal({
  isOpen,
  onClose,
  onResendEmail,
  isResending,
  resendCooldown
}: {
  isOpen: boolean;
  onClose: () => void;
  onResendEmail: () => void;
  isResending: boolean;
  resendCooldown: number;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Can't find your verification email?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3">
            <h4 className="font-medium">Here's what to check:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Check your spam/junk folder</li>
              <li>• Look for emails from WeWrite or {Emails.notifications}</li>
              <li>• Make sure your email address is correct in settings</li>
              <li>• Wait a few minutes - emails can be delayed</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                window.open('/settings/account', '_blank');
              }}
              className="w-full"
            >
              Check Email in Settings
            </Button>

            <Button
              onClick={onResendEmail}
              disabled={isResending || resendCooldown > 0}
              className="w-full"
            >
              {isResending ? 'Sending...' :
               resendCooldown > 0 ? `Wait ${resendCooldown}s` :
               'Send Again'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
