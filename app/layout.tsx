import React from "react"
import "./globals.css"
import "./utils/init-logger" // Initialize logging system early
import "./utils/errorSuppression" // Initialize error suppression early
import "./utils/detailedErrorLogging" // Initialize detailed error logging
import "./utils/developmentErrorOverride" // Initialize enhanced React error messages
import Script from 'next/script'
import { UnifiedErrorBoundary } from "./components/utils/UnifiedErrorBoundary"
import { GlobalErrorHandler } from "./components/utils/NextJSErrorHandler"

import SessionAuthInitializer from "./components/auth/SessionAuthInitializer"
import SessionMonitor from "./components/auth/SessionMonitor"
// SessionZustandBridge removed - functionality integrated into hybrid session system
import { DataProvider } from "./providers/DataProvider"
import { DateFormatProvider } from "./contexts/DateFormatContext"
import { AccentColorProvider } from "./contexts/AccentColorContext"
import { NeutralColorProvider } from "./contexts/NeutralColorContext"
import { AppBackgroundProvider } from "./contexts/AppBackgroundContext"
import { PillStyleProvider } from "./contexts/PillStyleContext"
// LoggingProvider removed - using unified logger from init-logger.ts
import { LineSettingsProvider } from "./contexts/LineSettingsContext"
import { RecentPagesProvider } from "./contexts/RecentPagesContext"
import { AllocationIncrementProvider } from "./contexts/AllocationIncrementContext"
import { UsdBalanceProvider } from "./contexts/UsdBalanceContext"
import { SubscriptionProvider } from "./contexts/SubscriptionContext"
import { EarningsProvider } from "./contexts/EarningsContext"
import { DemoBalanceProvider } from "./contexts/DemoBalanceContext"
import { AllocationIntervalProvider } from "./contexts/AllocationIntervalContext"
import { NavigationOrderProvider } from "./contexts/NavigationOrderContext"
import { UnifiedMobileNavProvider } from "./contexts/UnifiedMobileNavContext"
// import SimpleNavigationOptimizer from "./components/navigation/SimpleNavigationOptimizer" // Temporarily disabled

import { ThemeProvider } from "./providers/ThemeProvider"
import { AuthProvider } from "./providers/AuthProvider"
import { ReactQueryProvider } from "./providers/ReactQueryProvider"
import { NotificationProvider } from "./providers/NotificationProvider"
import { MobileProvider } from "./providers/MobileProvider"
import { LogRocketProvider } from "./providers/LogRocketProvider"
import { PWAProvider } from "./providers/PWAProvider"
import { BannerProvider } from "./providers/BannerProvider"
import GlobalNavigation from "./components/layout/GlobalNavigation"
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import PWAAnalyticsInitializer from './components/utils/PWAAnalyticsInitializer'
import AutomaticUpdateManager from './components/common/AutomaticUpdateManager'
import { FeatureFlagProvider } from "./contexts/FeatureFlagContext"
import { GlobalLandingBlobs } from "./components/landing/GlobalLandingBlobs"

export const metadata: Metadata = {
  metadataBase: new URL('https://www.getwewrite.app'),
  title: {
    default: 'WeWrite - Write, Share & Earn From Your Content',
    template: '%s | WeWrite'
  },
  description: 'Write and share your ideas on WeWrite. Earn money when readers support your work. Join our community of writers today.',
  keywords: [
    'writing platform',
    'collaborative writing',
    'content creation',
    'writer community',
    'monetize writing',
    'publish articles',
    'creative writing',
    'blog platform',
    'writer earnings',
    'content sharing'
  ],
  authors: [{ name: 'WeWrite', url: 'https://www.getwewrite.app' }],
  creator: 'WeWrite',
  publisher: 'WeWrite',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.getwewrite.app',
    siteName: 'WeWrite',
    title: 'WeWrite - Write, Share & Earn',
    description: 'Write and share your ideas on WeWrite. Earn money when readers support your work.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'WeWrite - Collaborative Writing Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WeWrite - Write, Share & Earn',
    description: 'Write and share your ideas. Earn money when readers support your work.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://www.getwewrite.app',
  },
  category: 'writing',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* CRITICAL: Apply saved accent colors BEFORE React hydrates to prevent flash of default color */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Determine current theme (dark/light)
                  var storedTheme = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var isDark = storedTheme === 'dark' || (storedTheme !== 'light' && prefersDark);

                  // Get the appropriate saved color based on theme
                  var colorKey = isDark ? 'accent-color-dark' : 'accent-color-light';
                  var savedColor = localStorage.getItem(colorKey);

                  if (savedColor) {
                    var color = JSON.parse(savedColor);
                    if (color.l !== undefined && color.c !== undefined && color.h !== undefined) {
                      // Format as OKLCH base value (e.g., "0.50 0.25 230")
                      var base = color.l.toFixed(2) + ' ' + color.c.toFixed(2) + ' ' + color.h.toFixed(1);

                      // Apply CSS variables immediately
                      var style = document.documentElement.style;
                      style.setProperty('--accent-base', base);
                      style.setProperty('--primary', base);
                      style.setProperty('--accent-l', color.l.toFixed(2));
                      style.setProperty('--accent-c', color.c.toFixed(2));
                      style.setProperty('--accent-h', color.h.toFixed(1));

                      // Set neutral base (reduced chroma for subtle appearance)
                      var neutralC = Math.min(color.c * 0.3, 0.05);
                      var neutralBase = color.l.toFixed(2) + ' ' + neutralC.toFixed(2) + ' ' + color.h.toFixed(1);
                      style.setProperty('--neutral-base', neutralBase);

                      // Dynamic foreground color based on lightness
                      var fg = color.l > 0.70 ? '0.00 0.00 0.0' : '1.00 0.00 0.0';
                      style.setProperty('--primary-foreground', fg);
                    }
                  }
                } catch (e) {
                  // Silently fail - React will apply defaults
                }
              })();
            `
          }}
        />
        {/* OPTIMIZATION: Resource hints for better performance */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//www.googletagmanager.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Preload critical API routes */}
        <link rel="prefetch" href="/api/pages" />
        {/* Organization Schema for WeWrite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'WeWrite',
              url: 'https://www.getwewrite.app',
              logo: 'https://www.getwewrite.app/logo.png',
              description: 'A collaborative writing platform where writers share ideas, earn from their content, and connect with readers.',
              sameAs: [],
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'customer support',
                url: 'https://www.getwewrite.app/support'
              },
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: 'https://www.getwewrite.app/search?q={search_term_string}'
                },
                'query-input': 'required name=search_term_string'
              }
            })
          }}
        />
        {/* WebSite Schema for sitelinks search box */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'WeWrite',
              url: 'https://www.getwewrite.app',
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: 'https://www.getwewrite.app/search?q={search_term_string}'
                },
                'query-input': 'required name=search_term_string'
              }
            })
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground" suppressHydrationWarning>
        {/* Early Firebase error suppression - must run before any other scripts */}
        <Script
          src="/firebase-error-suppression.js"
          strategy="beforeInteractive"
          priority
        />
        <UnifiedErrorBoundary>
          <GlobalErrorHandler />
          <ThemeProvider>
              <ReactQueryProvider>
                <AuthProvider>
                  <LogRocketProvider>
                    <PWAProvider>
                      <BannerProvider>
                        <NotificationProvider>
                      <MobileProvider>
                      <DataProvider>
                        <DateFormatProvider>
                                  <AccentColorProvider>
                                    <NeutralColorProvider>
                                      <SubscriptionProvider>
                                        <AppBackgroundProvider>
                                          <PillStyleProvider>
                                <FeatureFlagProvider>
                                <LineSettingsProvider>
                                  <RecentPagesProvider>
                                    <AllocationIncrementProvider>
                                        <DemoBalanceProvider>
                                          <UsdBalanceProvider>
                                            <EarningsProvider>
                                              <AllocationIntervalProvider>
                                          <NavigationOrderProvider>
                                            <UnifiedMobileNavProvider>
                                              <SessionAuthInitializer>
                                                <SessionMonitor />
                                                <AutomaticUpdateManager />
                                                <GlobalLandingBlobs />
                                                <GlobalNavigation>
                                                  {children}
                                                </GlobalNavigation>
                                              </SessionAuthInitializer>
                                            </UnifiedMobileNavProvider>
                                            </NavigationOrderProvider>
                                              </AllocationIntervalProvider>
                                            </EarningsProvider>
                                          </UsdBalanceProvider>
                                        </DemoBalanceProvider>
                                    </AllocationIncrementProvider>
                                  </RecentPagesProvider>
                                </LineSettingsProvider>
                                </FeatureFlagProvider>
                                  </PillStyleProvider>
                                </AppBackgroundProvider>
                              </SubscriptionProvider>
                            </NeutralColorProvider>
                          </AccentColorProvider>
                        </DateFormatProvider>
                      </DataProvider>
                    </MobileProvider>
                    </NotificationProvider>
                      </BannerProvider>
                    </PWAProvider>
                  </LogRocketProvider>
                </AuthProvider>
              </ReactQueryProvider>
            </ThemeProvider>
        </UnifiedErrorBoundary>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
