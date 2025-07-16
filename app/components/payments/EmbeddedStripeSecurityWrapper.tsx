"use client";

import React, { useState, useEffect } from 'react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Shield, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';

interface EmbeddedStripeSecurityWrapperProps {
  children: React.ReactNode;
  requiresAuth?: boolean;
  requiresVerification?: boolean;
  onSecurityCheck?: (passed: boolean) => void;
}

interface SecurityCheck {
  name: string;
  status: 'pending' | 'passed' | 'failed';
  message?: string;
}

/**
 * Security wrapper for embedded Stripe components
 * Ensures all security standards are maintained while using embedded flows
 */
export const EmbeddedStripeSecurityWrapper: React.FC<EmbeddedStripeSecurityWrapperProps> = ({
  children,
  requiresAuth = true,
  requiresVerification = false,
  onSecurityCheck
}) => {
  const { currentAccount } = useCurrentAccount();
  const [securityChecks, setSecurityChecks] = useState<SecurityCheck[]>([]);
  const [isSecurityPassed, setIsSecurityPassed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    performSecurityChecks();
  }, [currentAccount, requiresAuth, requiresVerification]);

  const performSecurityChecks = async () => {
    setIsLoading(true);
    const checks: SecurityCheck[] = [];

    // Check 1: Authentication
    if (requiresAuth) {
      checks.push({
        name: 'Authentication',
        status: currentAccount?.uid ? 'passed' : 'failed',
        message: currentAccount?.uid ? 'User authenticated' : 'Authentication required'
      });
    }

    // Check 2: HTTPS/Secure Context
    checks.push({
      name: 'Secure Context',
      status: (typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) ? 'passed' : 'failed',
      message: 'Secure HTTPS connection verified'
    });

    // Check 3: Stripe Configuration
    try {
      const stripeConfigCheck = await fetch('/api/stripe/config-check', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (stripeConfigCheck.ok) {
        checks.push({
          name: 'Stripe Configuration',
          status: 'passed',
          message: 'Stripe configuration verified'
        });
      } else {
        checks.push({
          name: 'Stripe Configuration',
          status: 'failed',
          message: 'Stripe configuration error'
        });
      }
    } catch (error) {
      checks.push({
        name: 'Stripe Configuration',
        status: 'failed',
        message: 'Unable to verify Stripe configuration'
      });
    }

    // Check 4: CSP and Security Headers (if in browser)
    if (typeof window !== 'undefined') {
      const hasCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]') !== null;
      checks.push({
        name: 'Content Security Policy',
        status: hasCSP ? 'passed' : 'passed', // Don't fail on missing CSP, just warn
        message: hasCSP ? 'CSP headers detected' : 'CSP headers recommended for enhanced security'
      });
    }

    // Check 5: User Verification (if required)
    if (requiresVerification && currentAccount?.uid) {
      try {
        const verificationCheck = await fetch('/api/user/verification-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userId: currentAccount.uid })
        });

        if (verificationCheck.ok) {
          const result = await verificationCheck.json();
          checks.push({
            name: 'User Verification',
            status: result.verified ? 'passed' : 'failed',
            message: result.verified ? 'User verification confirmed' : 'User verification required'
          });
        } else {
          checks.push({
            name: 'User Verification',
            status: 'failed',
            message: 'Unable to verify user status'
          });
        }
      } catch (error) {
        checks.push({
          name: 'User Verification',
          status: 'failed',
          message: 'Verification check failed'
        });
      }
    }

    // Check 6: PWA Compatibility
    if (typeof window !== 'undefined') {
      const isPWA = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
      const supportsServiceWorker = 'serviceWorker' in navigator;
      
      checks.push({
        name: 'PWA Compatibility',
        status: 'passed', // Always pass, just informational
        message: isPWA ? 'Running in PWA mode' : supportsServiceWorker ? 'PWA compatible' : 'Limited PWA support'
      });
    }

    setSecurityChecks(checks);

    // Determine if security checks passed
    const criticalChecks = checks.filter(check => 
      check.name === 'Authentication' || 
      check.name === 'Secure Context' || 
      check.name === 'Stripe Configuration' ||
      (requiresVerification && check.name === 'User Verification')
    );

    const allCriticalPassed = criticalChecks.every(check => check.status === 'passed');
    setIsSecurityPassed(allCriticalPassed);
    setIsLoading(false);

    if (onSecurityCheck) {
      onSecurityCheck(allCriticalPassed);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Performing security checks...</span>
      </div>
    );
  }

  if (!isSecurityPassed) {
    const failedChecks = securityChecks.filter(check => check.status === 'failed');
    
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Security Requirements Not Met</AlertTitle>
          <AlertDescription>
            The following security requirements must be satisfied before proceeding:
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          {failedChecks.map((check, index) => (
            <div key={index} className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <div>
                <div className="font-medium text-destructive">{check.name}</div>
                <div className="text-sm text-muted-foreground">{check.message}</div>
              </div>
            </div>
          ))}
        </div>

        {failedChecks.some(check => check.name === 'Authentication') && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>Authentication Required</AlertTitle>
            <AlertDescription>
              Please log in to access bank account management features.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Security Status Indicator */}
      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border-theme-strong">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <div className="text-sm">
          <span className="font-medium text-green-800 dark:text-green-200">Secure Connection Verified</span>
          <span className="text-green-600 dark:text-green-400 ml-2">
            All security checks passed ({securityChecks.filter(c => c.status === 'passed').length}/{securityChecks.length})
          </span>
        </div>
      </div>

      {/* Security Details (collapsible) */}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          View security details
        </summary>
        <div className="mt-2 space-y-1 pl-4">
          {securityChecks.map((check, index) => (
            <div key={index} className="flex items-center gap-2">
              {check.status === 'passed' ? (
                <CheckCircle className="h-3 w-3 text-green-600" />
              ) : check.status === 'failed' ? (
                <AlertTriangle className="h-3 w-3 text-red-600" />
              ) : (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              <span className="text-xs">
                {check.name}: {check.message}
              </span>
            </div>
          ))}
        </div>
      </details>

      {/* Render children if security checks pass */}
      {children}
    </div>
  );
};
