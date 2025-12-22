'use client';

import React from 'react';

// UI/Theme Providers (no auth dependency)
import { DateFormatProvider } from '../contexts/DateFormatContext';
import { AccentColorProvider } from '../contexts/AccentColorContext';
import { NeutralColorProvider } from '../contexts/NeutralColorContext';
import { PillStyleProvider } from '../contexts/PillStyleContext';
import { LineSettingsProvider } from '../contexts/LineSettingsContext';
import { FeatureFlagProvider } from '../contexts/FeatureFlagContext';

// Auth-dependent Providers (need user context)
import { SubscriptionProvider } from '../contexts/SubscriptionContext';
import { DemoBalanceProvider } from '../contexts/DemoBalanceContext';
import { UsdBalanceProvider } from '../contexts/UsdBalanceContext';
import { EarningsProvider } from '../contexts/EarningsContext';
import { AllocationIncrementProvider } from '../contexts/AllocationIncrementContext';
import { AllocationIntervalProvider } from '../contexts/AllocationIntervalContext';

// Navigation/App State Providers
import { RecentPagesProvider } from '../contexts/RecentPagesContext';
import { NavigationOrderProvider } from '../contexts/NavigationOrderContext';
import { UnifiedMobileNavProvider } from '../contexts/UnifiedMobileNavContext';
import { AppBackgroundProvider } from '../contexts/AppBackgroundContext';

/**
 * UIProviders - Theme and display-related contexts
 * These don't depend on auth state and can render immediately
 */
export function UIProviders({ children }: { children: React.ReactNode }) {
  return (
    <DateFormatProvider>
      <AccentColorProvider>
        <NeutralColorProvider>
          <PillStyleProvider>
            <FeatureFlagProvider>
              <LineSettingsProvider>
                {children}
              </LineSettingsProvider>
            </FeatureFlagProvider>
          </PillStyleProvider>
        </NeutralColorProvider>
      </AccentColorProvider>
    </DateFormatProvider>
  );
}

/**
 * FinancialProviders - Auth-dependent financial contexts
 * These require user authentication to function properly
 * Order matters: Subscription -> DemoBalance -> UsdBalance -> Earnings
 */
export function FinancialProviders({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionProvider>
      <AppBackgroundProvider>
        <DemoBalanceProvider>
          <UsdBalanceProvider>
            <EarningsProvider>
              <AllocationIncrementProvider>
                <AllocationIntervalProvider>
                  {children}
                </AllocationIntervalProvider>
              </AllocationIncrementProvider>
            </EarningsProvider>
          </UsdBalanceProvider>
        </DemoBalanceProvider>
      </AppBackgroundProvider>
    </SubscriptionProvider>
  );
}

/**
 * NavigationProviders - App navigation state
 * These depend on auth for personalized navigation
 */
export function NavigationProviders({ children }: { children: React.ReactNode }) {
  return (
    <RecentPagesProvider>
      <NavigationOrderProvider>
        <UnifiedMobileNavProvider>
          {children}
        </UnifiedMobileNavProvider>
      </NavigationOrderProvider>
    </RecentPagesProvider>
  );
}

/**
 * AllAppProviders - Complete provider stack for the app
 * Use this in layout.tsx to reduce nesting depth from ~25 to ~8 providers
 */
export function AllAppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UIProviders>
      <FinancialProviders>
        <NavigationProviders>
          {children}
        </NavigationProviders>
      </FinancialProviders>
    </UIProviders>
  );
}
