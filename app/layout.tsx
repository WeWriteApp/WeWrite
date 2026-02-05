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
import { DataProvider } from "./providers/DataProvider"
import { AllAppProviders } from "./providers/ConsolidatedProviders"

import { ThemeProvider } from "./providers/ThemeProvider"
import { AuthProvider } from "./providers/AuthProvider"
import { ReactQueryProvider } from "./providers/ReactQueryProvider"
import { NotificationProvider } from "./providers/NotificationProvider"
import { MobileProvider } from "./providers/MobileProvider"
import { LogRocketProvider } from "./providers/LogRocketProvider"
import { GAUserIdentityProvider } from "./providers/GAUserIdentityProvider"
import { PWAProvider } from "./providers/PWAProvider"
import { BannerProvider } from "./providers/BannerProvider"
import { PreviousRouteProvider } from "./providers/PreviousRouteProvider"
import { GlobalDrawerProvider } from "./providers/GlobalDrawerProvider"
import GlobalNavigation from "./components/layout/GlobalNavigation"
import GlobalDrawerRenderer from "./components/layout/GlobalDrawerRenderer"
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import PWAAnalyticsInitializer from './components/utils/PWAAnalyticsInitializer'
import AutomaticUpdateManager from './components/common/AutomaticUpdateManager'
import { ServiceWorkerRegistration } from './components/performance/ServiceWorkerRegistration'
import { GlobalLandingBlobs } from "./components/landing/GlobalLandingBlobs"
import ScrollRestorationDisabler from "./components/utils/ScrollRestorationDisabler"
import UILabelTooltipOverlay from "./components/utils/UILabelTooltipOverlay"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  metadataBase: new URL('https://www.getwewrite.app'),
  title: {
    default: 'WeWrite - Write, Share & Earn From Your Content',
    template: '%s | WeWrite'
  },
  description: 'Write and share your ideas on WeWrite. Earn money when readers support your work. Join our community of writers today.',
  keywords: [
    // Core platform
    'writing platform',
    'collaborative writing',
    'content creation',
    'writer community',
    'monetize writing',
    'publish articles',
    'creative writing',
    'blog platform',
    'writer earnings',
    'content sharing',
    // Monetization
    'earn money writing',
    'get paid to write',
    'reader-funded publishing',
    'tip jar for writers',
    'direct creator support',
    'crowdfunding for writers',
    // Alternatives
    'Medium alternative',
    'Substack alternative',
    'free blogging platform',
    'Ghost alternative',
    // Features
    'real-time collaboration',
    'wiki-style writing',
    'linked writing',
    'version history',
    'collaborative editing',
    // Values
    'free speech platform',
    'no algorithm',
    'own your content',
    'independent publishing',
    // Use cases
    'citizen journalism',
    'independent journalism',
    'newsletter platform',
    'essay publishing',
    'fiction publishing',
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
  // Theme color for PWA status bar - dynamically updated by MobileBottomNav
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
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
                <GAUserIdentityProvider />
                <LogRocketProvider>
                  <PWAProvider>
                    <BannerProvider>
                      <NotificationProvider>
                        <MobileProvider>
                          <DataProvider>
                            <AllAppProviders>
                              <PreviousRouteProvider>
                                <GlobalDrawerProvider>
                                  <SessionAuthInitializer>
                                    <SessionMonitor />
                                    <AutomaticUpdateManager />
                                    <ServiceWorkerRegistration />
                                    <ScrollRestorationDisabler />
                                    <GlobalLandingBlobs />
                                    <GlobalNavigation>
                                      {children}
                                    </GlobalNavigation>
                                    {/* Global drawer overlay for settings/admin on mobile */}
                                    <GlobalDrawerRenderer />
                                    {/* UI label tooltips for admin debugging */}
                                    <UILabelTooltipOverlay />
                                    {/* Toast notifications - theme="system" for auto dark/light mode */}
                                    <Toaster
                                      richColors
                                      position="bottom-right"
                                      theme="system"
                                      toastOptions={{
                                        classNames: {
                                          toast: 'dark:bg-neutral-900 dark:border-neutral-800',
                                          title: 'dark:text-neutral-100',
                                          description: 'dark:text-neutral-400',
                                          actionButton: 'dark:bg-primary dark:text-primary-foreground',
                                          cancelButton: 'dark:bg-neutral-800 dark:text-neutral-400',
                                        }
                                      }}
                                    />
                                  </SessionAuthInitializer>
                                </GlobalDrawerProvider>
                              </PreviousRouteProvider>
                            </AllAppProviders>
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
