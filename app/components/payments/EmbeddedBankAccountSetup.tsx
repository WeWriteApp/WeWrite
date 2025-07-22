"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Wallet, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '../ui/use-toast';
import { getStripePublishableKey } from '../../utils/stripeConfig';
import { EmbeddedStripeSecurityWrapper } from './EmbeddedStripeSecurityWrapper';

// Stripe Connect JS types
declare global {
  interface Window {
    StripeConnect?: any;
  }
}

interface EmbeddedBankAccountSetupProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  showTitle?: boolean;
}

interface AccountSessionData {
  client_secret: string;
  account_id: string;
  expires_at: number;
}

export const EmbeddedBankAccountSetup: React.FC<EmbeddedBankAccountSetupProps> = ({
  onSuccess,
  onCancel,
  showTitle = true
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountSession, setAccountSession] = useState<AccountSessionData | null>(null);
  const [stripeConnect, setStripeConnect] = useState<any>(null);
  const [componentMounted, setComponentMounted] = useState(false);
  
  const onboardingRef = useRef<HTMLDivElement>(null);
  const accountManagementRef = useRef<HTMLDivElement>(null);

  // Load Stripe Connect JS
  useEffect(() => {
    const loadStripeConnect = async () => {
      if (window.StripeConnect) {
        return window.StripeConnect;
      }

      const script = document.createElement('script');
      script.src = 'https://connect-js.stripe.com/v1.0/connect.js';
      script.async = true;
      
      return new Promise((resolve, reject) => {
        script.onload = () => {
          if (window.StripeConnect) {
            resolve(window.StripeConnect);
          } else {
            reject(new Error('Stripe Connect failed to load'));
          }
        };
        script.onerror = () => reject(new Error('Failed to load Stripe Connect script'));
        document.head.appendChild(script);
      });
    };

    loadStripeConnect()
      .then((StripeConnect) => {
        const publishableKey = getStripePublishableKey();
        if (!publishableKey) {
          throw new Error('Stripe publishable key not configured');
        }

        const connectInstance = StripeConnect(publishableKey);
        setStripeConnect(connectInstance);
      })
      .catch((err) => {
        console.error('Error loading Stripe Connect:', err);
        setError('Failed to load payment components. Please refresh the page.');
      });
  }, []);

  // Create Account Session when component mounts
  useEffect(() => {
    if (!user?.uid || !stripeConnect) return;

    const createAccountSession = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/stripe/account-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            components: {
              account_onboarding: {
                enabled: true,
                features: {
                  external_account_collection: true
                }
              },
              account_management: {
                enabled: true,
                features: {
                  external_account_collection: true
                }
              }
            }
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create account user');
        }

        const sessionData = await response.json();
        setAccountSession(sessionData);

      } catch (err) {
        console.error('Error creating account session:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize bank account setup');
      } finally {
        setLoading(false);
      }
    };

    createAccountSession();
  }, [user?.uid, stripeConnect]);

  // Mount Stripe Connect components when account user is ready
  useEffect(() => {
    if (!stripeConnect || !accountSession || componentMounted) return;

    const mountComponents = async () => {
      try {
        // Initialize Stripe Connect with the account user
        await stripeConnect.initialize({
          clientSecret: accountSession.client_secret
        });

        // Check if account needs onboarding or just management
        const needsOnboarding = await checkOnboardingStatus();

        if (needsOnboarding && onboardingRef.current) {
          // Mount account onboarding component
          const onboardingComponent = stripeConnect.create('account-onboarding');
          
          onboardingComponent.setOnExit(() => {
            console.log('User exited onboarding flow');
            if (onCancel) onCancel();
          });

          onboardingComponent.setOnLoadError((error: any) => {
            console.error('Onboarding component load error:', error);
            setError('Failed to load bank account setup. Please try again.');
          });

          onboardingRef.current.appendChild(onboardingComponent);
          
        } else if (accountManagementRef.current) {
          // Mount account management component for existing accounts
          const managementComponent = stripeConnect.create('account-management');
          
          managementComponent.setOnLoadError((error: any) => {
            console.error('Management component load error:', error);
            setError('Failed to load account management. Please try again.');
          });

          accountManagementRef.current.appendChild(managementComponent);
        }

        setComponentMounted(true);

        // Listen for account updates
        listenForAccountUpdates();

      } catch (err) {
        console.error('Error mounting Stripe Connect components:', err);
        setError('Failed to load bank account components. Please refresh the page.');
      }
    };

    mountComponents();
  }, [stripeConnect, accountSession, componentMounted]);

  const checkOnboardingStatus = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/stripe/account-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user?.uid })
      });

      if (response.ok) {
        const result = await response.json();
        // If details_submitted is false, account needs onboarding
        return !result.data?.details_submitted;
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    }
    
    // Default to onboarding if we can't determine status
    return true;
  };

  const listenForAccountUpdates = () => {
    // Poll for account status updates
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/stripe/account-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user?.uid })
        });

        if (response.ok) {
          const result = await response.json();
          const accountData = result.data;
          
          // Check if bank account is now connected and verified
          if (accountData?.bank_account && accountData?.payouts_enabled) {
            clearInterval(pollInterval);
            
            toast({
              title: "Bank Account Connected",
              description: "Your bank account has been successfully connected and verified."
            });

            if (onSuccess) {
              onSuccess();
            }
          }
        }
      } catch (error) {
        console.error('Error polling account status:', error);
      }
    }, 3000); // Poll every 3 seconds

    // Clean up polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 300000);
  };

  if (!user) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>
          Please log in to set up your bank account.
        </AlertDescription>
      </Alert>
    );
  }

  const content = (
    <EmbeddedStripeSecurityWrapper requiresAuth={true}>
      <div className="space-y-6" data-testid="bank-setup-container">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading bank account setup...</span>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="text-center">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">Connect Your Bank Account</h4>
            <p className="text-muted-foreground mb-6">
              Securely connect your bank account to receive payouts from your supporters.
              All information is processed securely by Stripe.
            </p>
          </div>

          {/* Account Onboarding Component */}
          <div ref={onboardingRef} className="min-h-[400px]" />
          
          {/* Account Management Component (for existing accounts) */}
          <div ref={accountManagementRef} className="min-h-[400px]" />

          {onCancel && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          )}
        </>
      )}
      </div>
    </EmbeddedStripeSecurityWrapper>
  );

  if (!showTitle) {
    return content;
  }

  return (
    <Card className="wewrite-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Bank Account Setup
        </CardTitle>
        <CardDescription>
          Connect your bank account securely to receive payouts from supporters.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
};
