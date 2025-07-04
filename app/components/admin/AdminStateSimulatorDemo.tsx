'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { useSimulatedAppState } from '../../providers/AdminStateSimulatorProvider';
import { useSimulatedAuth } from '../../hooks/useSimulatedAuth';

/**
 * Demo component showing how existing components can integrate with the admin state simulator
 * This demonstrates how to use simulated state in your components
 */
export default function AdminStateSimulatorDemo() {
  const simulatedState = useSimulatedAppState();
  const { isAuthenticated, user, isSimulated, simulatedState: authSimulatedState } = useSimulatedAuth();

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Admin State Simulator Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Authentication State Demo */}
          <div>
            <h3 className="font-medium mb-2">Authentication State</h3>
            <div className="flex items-center gap-2">
              <Badge variant={isAuthenticated ? "default" : "secondary"}>
                {isAuthenticated ? "Logged In" : "Logged Out"}
              </Badge>
              {isSimulated && (
                <Badge variant="outline" className="text-orange-600">
                  Simulated: {authSimulatedState}
                </Badge>
              )}
            </div>
            {isAuthenticated && user && (
              <p className="text-sm text-muted-foreground mt-1">
                User: {user.email || user.displayName || 'Unknown'}
              </p>
            )}
          </div>

          {/* Subscription State Demo */}
          <div>
            <h3 className="font-medium mb-2">Subscription State</h3>
            <div className="flex items-center gap-2">
              {simulatedState.subscription.isActive && (
                <Badge variant="default" className="bg-green-600">Active</Badge>
              )}
              {simulatedState.subscription.hasNone && (
                <Badge variant="secondary">No Subscription</Badge>
              )}
              {simulatedState.subscription.isCancelling && (
                <Badge variant="destructive">Cancelling</Badge>
              )}
              {simulatedState.subscription.hasPaymentFailed && (
                <Badge variant="destructive">Payment Failed</Badge>
              )}
            </div>
          </div>

          {/* Spending State Demo */}
          <div>
            <h3 className="font-medium mb-2">Spending State</h3>
            {simulatedState.spending.pastMonthTokensSent ? (
              <Badge variant="default" className="bg-purple-600">
                Tokens Sent This Month
              </Badge>
            ) : (
              <Badge variant="outline">No Tokens Sent</Badge>
            )}
          </div>

          {/* Token Earnings Demo */}
          <div>
            <h3 className="font-medium mb-2">Token Earnings</h3>
            <div className="space-y-2">
              {simulatedState.tokenEarnings.none && (
                <Badge variant="outline">No Earnings</Badge>
              )}
              {simulatedState.tokenEarnings.unfundedLoggedOut && (
                <Badge variant="secondary" className="bg-gray-500">
                  10 Unfunded (Logged Out Users)
                </Badge>
              )}
              {simulatedState.tokenEarnings.unfundedNoSubscription && (
                <Badge variant="secondary" className="bg-gray-600">
                  10 Unfunded (No Subscription)
                </Badge>
              )}
              {simulatedState.tokenEarnings.fundedPending && (
                <Badge variant="default" className="bg-yellow-600">
                  10 Pending (Funded)
                </Badge>
              )}
              {simulatedState.tokenEarnings.lockedAvailable && (
                <Badge variant="default" className="bg-green-600">
                  10 Available (Locked)
                </Badge>
              )}
            </div>
          </div>

          {/* Example of conditional rendering based on simulated state */}
          <div className="space-y-2">
            <h3 className="font-medium">Conditional UI Examples</h3>
            
            {!isAuthenticated && (
              <Alert>
                <AlertDescription>
                  Please log in to access this feature.
                </AlertDescription>
              </Alert>
            )}

            {isAuthenticated && simulatedState.subscription.hasNone && (
              <Alert>
                <AlertDescription>
                  Subscribe to unlock premium features.
                </AlertDescription>
              </Alert>
            )}

            {isAuthenticated && simulatedState.subscription.hasPaymentFailed && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">
                  Your payment failed. Please update your payment method.
                </AlertDescription>
              </Alert>
            )}

            {isAuthenticated && simulatedState.subscription.isCancelling && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertDescription className="text-orange-800">
                  Your subscription is set to cancel at the end of the billing period.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Code Example */}
          <div className="bg-gray-50 p-3 rounded-md">
            <h4 className="font-medium text-sm mb-2">How to use in your components:</h4>
            <pre className="text-xs text-gray-700 overflow-x-auto">
{`import { useSimulatedAppState } from '../providers/AdminStateSimulatorProvider';
import { useSimulatedAuth } from '../hooks/useSimulatedAuth';

function MyComponent() {
  const simulatedState = useSimulatedAppState();
  const { isAuthenticated, isSimulated } = useSimulatedAuth();

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  if (simulatedState.subscription.hasNone) {
    return <SubscriptionPrompt />;
  }

  return <MainContent />;
}`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Example of how to create a component that responds to simulated state
 */
export function ExampleResponsiveComponent() {
  const simulatedState = useSimulatedAppState();
  const { isAuthenticated } = useSimulatedAuth();

  // Example: Show different content based on subscription state
  if (!isAuthenticated) {
    return (
      <div className="text-center p-4">
        <h2>Welcome to WeWrite</h2>
        <p>Please log in to continue</p>
      </div>
    );
  }

  if (simulatedState.subscription.hasNone) {
    return (
      <div className="text-center p-4">
        <h2>Upgrade to Premium</h2>
        <p>Subscribe to unlock all features</p>
      </div>
    );
  }

  if (simulatedState.subscription.hasPaymentFailed) {
    return (
      <div className="text-center p-4 bg-red-50 border border-red-200 rounded">
        <h2>Payment Issue</h2>
        <p>Please update your payment method to continue</p>
      </div>
    );
  }

  // Show earnings based on simulated state
  const hasEarnings = !simulatedState.tokenEarnings.none;
  
  return (
    <div className="p-4">
      <h2>Dashboard</h2>
      {hasEarnings ? (
        <div>
          <h3>Your Earnings</h3>
          {simulatedState.tokenEarnings.fundedPending && (
            <p>You have 10 tokens pending for next month</p>
          )}
          {simulatedState.tokenEarnings.lockedAvailable && (
            <p>You have 10 tokens available for payout</p>
          )}
        </div>
      ) : (
        <p>No earnings yet. Start writing to earn tokens!</p>
      )}
    </div>
  );
}
