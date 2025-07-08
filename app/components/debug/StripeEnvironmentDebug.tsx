"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Copy, Eye, EyeOff, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { getStripePublishableKey, getStripeSecretKey, getStripeWebhookSecret } from '../../utils/stripeConfig';

/**
 * StripeEnvironmentDebug - Debug component for troubleshooting Stripe configuration
 * 
 * This component helps diagnose Stripe environment issues on Vercel preview deployments
 * by showing which keys are being used and environment detection logic.
 */
export default function StripeEnvironmentDebug() {
  const [showSecrets, setShowSecrets] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Environment detection
  const isClient = typeof window !== 'undefined';
  const hostname = isClient ? window.location.hostname : 'server';
  const isVercelPreview = hostname.includes('vercel.app') && !hostname.includes('wewrite.app');
  const isDevelopment = process.env.NODE_ENV === 'development';
  const vercelEnv = process.env.VERCEL_ENV;

  // Get Stripe keys
  const publishableKey = getStripePublishableKey();
  const secretKeyPreview = isClient ? 'Hidden (client-side)' : getStripeSecretKey();
  const webhookSecretPreview = isClient ? 'Hidden (client-side)' : getStripeWebhookSecret();

  // Environment variables (client-side only shows public ones)
  const envVars = {
    'NODE_ENV': process.env.NODE_ENV,
    'VERCEL_ENV': process.env.VERCEL_ENV,
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY': process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.substring(0, 8) + '...',
    'NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY': process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY?.substring(0, 8) + '...',
    'NEXT_PUBLIC_STRIPE_PROD_PUBLISHABLE_KEY': process.env.NEXT_PUBLIC_STRIPE_PROD_PUBLISHABLE_KEY?.substring(0, 8) + '...',
  };

  const maskKey = (key: string | undefined) => {
    if (!key) return 'Not set';
    if (!showSecrets) return key.substring(0, 8) + '...';
    return key;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const testStripeConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/debug/stripe-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      setTestResults(result);
    } catch (error) {
      setTestResults({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Stripe Environment Debug
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Environment Detection */}
          <div>
            <h3 className="font-semibold mb-3">Environment Detection</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Hostname:</span>
                  <Badge variant="outline">{hostname}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Is Vercel Preview:</span>
                  <Badge variant={isVercelPreview ? "default" : "secondary"}>
                    {isVercelPreview ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Is Development:</span>
                  <Badge variant={isDevelopment ? "default" : "secondary"}>
                    {isDevelopment ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">VERCEL_ENV:</span>
                  <Badge variant="outline">{vercelEnv || 'Not set'}</Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Stripe Keys */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Stripe Configuration</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSecrets(!showSecrets)}
                className="flex items-center gap-2"
              >
                {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showSecrets ? 'Hide' : 'Show'} Keys
              </Button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <span className="font-medium">Publishable Key:</span>
                  <div className="text-sm text-muted-foreground">
                    {maskKey(publishableKey)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(publishableKey || '')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <span className="font-medium">Secret Key:</span>
                  <div className="text-sm text-muted-foreground">
                    {maskKey(secretKeyPreview as string)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <span className="font-medium">Webhook Secret:</span>
                  <div className="text-sm text-muted-foreground">
                    {maskKey(webhookSecretPreview as string)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Environment Variables */}
          <div>
            <h3 className="font-semibold mb-3">Environment Variables</h3>
            <div className="space-y-2">
              {Object.entries(envVars).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-2 border rounded text-sm">
                  <span className="font-mono">{key}:</span>
                  <span className="text-muted-foreground">{value || 'Not set'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Test Connection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Connection Test</h3>
              <Button
                onClick={testStripeConnection}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                {isLoading ? 'Testing...' : 'Test Stripe Connection'}
              </Button>
            </div>
            
            {testResults && (
              <Alert className={testResults.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-center gap-2">
                  {testResults.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription>
                    {testResults.success ? 'Stripe connection successful!' : `Error: ${testResults.error}`}
                  </AlertDescription>
                </div>
                {testResults.details && (
                  <div className="mt-2 text-sm">
                    <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(testResults.details, null, 2)}
                    </pre>
                  </div>
                )}
              </Alert>
            )}
          </div>

          {/* Recommendations */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>For Vercel Preview Issues:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• Ensure STRIPE_TEST_SECRET_KEY is set in Vercel environment variables</li>
                <li>• Ensure NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY is set</li>
                <li>• Check that webhook endpoints are configured for preview domains</li>
                <li>• Verify that test mode is enabled in Stripe dashboard</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
