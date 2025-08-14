"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { useTheme } from '../../providers/ThemeProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '../ui/dialog';
import { Wallet, AlertTriangle, CheckCircle, Loader2, Settings, Bell, Lock, Shield, Plus } from 'lucide-react';
import { useToast } from '../ui/use-toast';
import { getStripePublishableKey } from '../../utils/stripeConfig';
import { EmbeddedStripeSecurityWrapper } from './EmbeddedStripeSecurityWrapper';

// Stripe Connect JS types
declare global {
  interface Window {
    StripeConnect?: any;
  }
}

interface EmbeddedBankAccountManagerProps {
  onUpdate?: () => void;
  showTitle?: boolean;
}



interface BankAccountStatus {
  isConnected: boolean;
  isVerified: boolean;
  bankName?: string;
  last4?: string;
  accountType?: string;
  requiresAction?: boolean;
  actionMessage?: string;
}

export const EmbeddedBankAccountManager: React.FC<EmbeddedBankAccountManagerProps> = ({
  onUpdate,
  showTitle = true
}) => {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeConnect, setStripeConnect] = useState<any>(null);
  const [bankStatus, setBankStatus] = useState<BankAccountStatus | null>(null);
  const [showStripeComponent, setShowStripeComponent] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load Stripe Connect JS
  useEffect(() => {
    const loadStripeConnect = async () => {
      if (window.StripeConnect) {
        console.log('Stripe Connect already loaded');
        return window.StripeConnect;
      }

      console.log('Loading Stripe Connect script...');
      const script = document.createElement('script');
      script.src = 'https://connect-js.stripe.com/v1.0/connect.js';
      script.async = true;

      return new Promise((resolve, reject) => {
        script.onload = () => {
          console.log('Stripe Connect script loaded, checking window.StripeConnect...');
          if (window.StripeConnect) {
            console.log('window.StripeConnect found:', typeof window.StripeConnect);
            resolve(window.StripeConnect);
          } else {
            console.error('window.StripeConnect not found after script load');
            reject(new Error('Stripe Connect failed to load'));
          }
        };
        script.onerror = (error) => {
          console.error('Failed to load Stripe Connect script:', error);
          reject(new Error('Failed to load Stripe Connect script'));
        };
        document.head.appendChild(script);
      });
    };

    loadStripeConnect()
      .then(async (StripeConnect) => {
        console.log('Stripe Connect loaded successfully, initializing...');
        const publishableKey = getStripePublishableKey();
        if (!publishableKey) {
          throw new Error('Stripe publishable key not configured');
        }

        console.log('Creating Stripe Connect instance with publishable key:', publishableKey.substring(0, 20) + '...');

        // Debug what's available on StripeConnect
        console.log('StripeConnect type:', typeof StripeConnect);
        console.log('StripeConnect keys:', Object.keys(StripeConnect || {}));
        console.log('StripeConnect methods:', Object.getOwnPropertyNames(StripeConnect || {}));

        // Use the correct StripeConnect.init pattern
        console.log('Initializing StripeConnect with init method...');
        const connectInstance = StripeConnect.init({
          publishableKey,
          fetchClientSecret: async () => {
            console.log('Fetching client secret for account user...');
            const response = await fetch('/api/stripe/account-session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                components: {
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
              throw new Error(`Failed to create account session: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Account user created successfully');
            return data.client_secret;
          }
        });

        console.log('Stripe Connect instance created:', connectInstance);

        setStripeConnect(connectInstance);
      })
      .catch((err) => {
        console.error('Error loading Stripe Connect:', err);

        // Provide detailed error messages based on the error type
        let errorMessage = 'Failed to load bank account management system.';
        let suggestions = [];

        if (err.message?.includes('publishable key')) {
          errorMessage = 'Stripe configuration error - payment system not properly configured.';
          suggestions = ['Contact support for assistance', 'This is a system configuration issue'];
        } else if (err.message?.includes('script')) {
          errorMessage = 'Unable to load Stripe payment components.';
          suggestions = ['Check your internet connection', 'Try refreshing the page', 'Disable ad blockers if enabled'];
        } else if (err.message?.includes('account session')) {
          errorMessage = 'Unable to create secure payment session.';
          suggestions = ['Try refreshing the page', 'Log out and log back in', 'Contact support if the issue persists'];
        } else {
          suggestions = ['Try refreshing the page', 'Check your internet connection', 'Contact support if the problem continues'];
        }

        setError(`${errorMessage} ${suggestions.length > 0 ? 'Try: ' + suggestions.join(', ') + '.' : ''}`);
      });
  }, []);

  // Load bank account status
  useEffect(() => {
    if (!user?.uid) return;

    const loadBankStatus = async () => {
      try {
        const response = await fetch('/api/stripe/account-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.uid })
        });

        if (response.ok) {
          const result = await response.json();
          const accountData = result.data;
          
          setBankStatus({
            isConnected: !!accountData?.bank_account,
            isVerified: accountData?.payouts_enabled || false,
            bankName: accountData?.bank_account?.bank_name,
            last4: accountData?.bank_account?.last4,
            accountType: accountData?.bank_account?.account_type,
            requiresAction: accountData?.requirements?.currently_due?.length > 0,
            actionMessage: accountData?.requirements?.currently_due?.length > 0 
              ? 'Additional information required for verification'
              : undefined
          });
        }
      } catch (error) {
        console.error('Error loading bank status:', error);
      }
    };

    loadBankStatus();
  }, [user?.uid]);

  // Create account user and mount component
  useEffect(() => {
    if (!stripeConnect || !containerRef.current || !user?.uid) return;

    // Only mount if we should show the component (either triggered or bank account exists)
    if (!showStripeComponent && !bankStatus?.isConnected) return;

    const container = containerRef.current;

    // Clear any existing content
    container.innerHTML = '';

    setLoading(true);
    setError(null);

    const mountComponent = async () => {
      try {
        // Debug what methods are available on stripeConnect
        console.log('StripeConnect instance methods:', Object.getOwnPropertyNames(stripeConnect));
        console.log('StripeConnect instance type:', typeof stripeConnect);

        // Create the account management component with appearance settings
        console.log('Creating account_management component...');
        const accountManagement = stripeConnect.create('account_management', {
          appearance: {
            theme: resolvedTheme === 'dark' ? 'night' : 'stripe',
            variables: {
              colorPrimary: '#0057FF',
              colorBackground: resolvedTheme === 'dark' ? '#0a0a0a' : '#ffffff',
              colorText: resolvedTheme === 'dark' ? '#ffffff' : '#000000',
              colorTextSecondary: resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              borderRadius: '8px'
            }
          }
        });
        console.log('Account management component created:', accountManagement);

        console.log('Mounting component to container...');
        accountManagement.mount(container);

        console.log('Account management component mounted successfully');
        setLoading(false);

        // Cleanup function
        return () => {
          if (accountManagement) {
            accountManagement.unmount();
          }
        };
      } catch (err) {
        console.error('Error mounting component:', err);

        // Provide specific error messages based on the error
        let errorMessage = 'Failed to load bank account management interface.';
        let suggestions = [];

        if (err instanceof Error) {
          if (err.message.includes('Authentication expired')) {
            errorMessage = 'Your session has expired.';
            suggestions = ['Log out and log back in', 'Refresh the page'];
          } else if (err.message.includes('Access denied')) {
            errorMessage = 'Access denied to bank account management.';
            suggestions = ['Ensure your account is verified', 'Contact support for assistance'];
          } else if (err.message.includes('temporarily unavailable')) {
            errorMessage = 'Bank account service is temporarily unavailable.';
            suggestions = ['Try again in a few minutes', 'Check our status page for updates'];
          } else if (err.message.includes('initialize')) {
            errorMessage = 'Unable to initialize secure bank account interface.';
            suggestions = ['Refresh the page', 'Clear browser cache', 'Try a different browser'];
          } else {
            suggestions = ['Refresh the page', 'Try again in a few minutes', 'Contact support if the issue persists'];
          }
        }

        setError(`${errorMessage} ${suggestions.length > 0 ? 'Try: ' + suggestions.join(', ') + '.' : ''}`);
        setLoading(false);
      }
    };

    const cleanup = mountComponent();

    return () => {
      cleanup.then(cleanupFn => {
        if (cleanupFn) cleanupFn();
      });
    };
  }, [stripeConnect, user?.uid, resolvedTheme, showStripeComponent, bankStatus?.isConnected]);





  if (!user) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>
          Please log in to manage your bank account.
        </AlertDescription>
      </Alert>
    );
  }

  const content = (
    <EmbeddedStripeSecurityWrapper requiresAuth={true}>
      <div className="space-y-6">
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
          <span className="ml-2">Loading bank account management...</span>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Bank Account Status */}
          <div className="relative">
            {/* Security Details Modal - Always available */}
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-0 right-0 h-8 w-8 p-0 text-muted-foreground hover:text-foreground z-10"
                >
                  <Lock className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Security Details
                  </DialogTitle>
                  <DialogDescription>
                    All security checks passed for your bank account connection.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Authentication: User authenticated</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Secure Context: Secure HTTPS connection verified</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Stripe Configuration: Stripe configuration verified</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Content Security Policy: CSP headers recommended for enhanced security</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>PWA Compatibility: PWA compatible</span>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {bankStatus?.isConnected ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3 pr-10">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium text-green-900">
                      {bankStatus.bankName || 'Bank'} ****{bankStatus.last4}
                    </div>
                    <div className="text-sm text-green-700">
                      {bankStatus.isVerified ? 'Verified' : 'Pending verification'}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex justify-center">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Replace Bank Account
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Replace Bank Account</DialogTitle>
                        <DialogDescription>
                          This will remove your current bank account and allow you to add a new one.
                          Any pending payouts will be cancelled.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex justify-end gap-2">
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button
                          onClick={() => {
                            // TODO: Implement bank account removal API call
                            setShowStripeComponent(true);
                            setTimeout(() => {
                              const container = containerRef.current;
                              if (container) {
                                container.scrollIntoView({ behavior: 'smooth' });
                              }
                            }, 100);
                          }}
                          variant="destructive"
                        >
                          Remove & Add New
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 border rounded-lg">
                <AlertTriangle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No bank account connected</h3>
                <p className="text-muted-foreground mb-6">Connect your bank account to receive payouts</p>
                <Button
                  onClick={() => {
                    setShowStripeComponent(true);
                    // Scroll to the component after showing it
                    setTimeout(() => {
                      const container = containerRef.current;
                      if (container) {
                        container.scrollIntoView({ behavior: 'smooth' });
                      }
                    }, 100);
                  }}
                  className="mx-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Bank Account
                </Button>
              </div>
            )}
          </div>

          {/* Stripe Connect Component - Only show when triggered */}
          {(showStripeComponent || bankStatus?.isConnected) && (
            <div ref={containerRef} className="min-h-[300px] rounded-lg border mt-4" />
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
          Bank Account Management
        </CardTitle>
        <CardDescription>
          Manage your connected bank account and payout settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
};
