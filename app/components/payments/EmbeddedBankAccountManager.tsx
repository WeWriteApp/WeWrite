"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Wallet, AlertTriangle, CheckCircle, Loader2, Settings, Bell } from 'lucide-react';
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
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeConnect, setStripeConnect] = useState<any>(null);
  const [bankStatus, setBankStatus] = useState<BankAccountStatus | null>(null);

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
            const response = await fetch('/api/stripe/account-user', {
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
        setError('Failed to load payment components. Please refresh the page.');
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

    const container = containerRef.current;

    // Clear any existing content
    container.innerHTML = '';

    setLoading(true);
    setError(null);

    const mountComponent = async () => {
      try {
        // Create account user
        const response = await fetch('/api/stripe/account-user', {
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

        const sessionData = await response.json();
        console.log('Account user created successfully');

        // Debug what methods are available on stripeConnect
        console.log('StripeConnect instance methods:', Object.getOwnPropertyNames(stripeConnect));
        console.log('StripeConnect instance type:', typeof stripeConnect);

        // Initialize Stripe Connect with the account user
        console.log('Calling stripeConnect.initialize...');
        await stripeConnect.initialize({
          clientSecret: sessionData.client_secret
        });
        console.log('StripeConnect initialized successfully');

        // Create and mount the account management component
        console.log('Creating account-management component...');
        const accountManagement = stripeConnect.create('account-management');
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
        setError('Failed to load account management interface.');
        setLoading(false);
      }
    };

    const cleanup = mountComponent();

    return () => {
      cleanup.then(cleanupFn => {
        if (cleanupFn) cleanupFn();
      });
    };
  }, [stripeConnect, user?.uid]);





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
          {bankStatus && (
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Bank Account Status</span>
                </div>
                {bankStatus.isVerified ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                )}
              </div>
              
              {bankStatus.isConnected ? (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank:</span>
                    <span>{bankStatus.bankName || 'Connected'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account:</span>
                    <span>****{bankStatus.last4}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className={bankStatus.isVerified ? 'text-green-600' : 'text-yellow-600'}>
                      {bankStatus.isVerified ? 'Verified' : 'Pending Verification'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No bank account connected</p>
              )}
            </div>
          )}

          {/* Stripe Connect Component */}
          <div ref={containerRef} className="min-h-[400px]" />
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
