import "./globals.css"
import "./styles/scrollbar-hide.css"
import "./styles/loader.css"
import "./styles/responsive-table.css"
import "./components/editor-styles.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "./providers/ThemeProvider"
import { AuthProvider } from "./providers/AuthProvider"
import { AppProvider } from "./providers/AppProvider"
import { DataProvider } from "./providers/DataProvider"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { UnifiedAnalyticsProvider } from "./providers/UnifiedAnalyticsProvider"
import dynamic from "next/dynamic"
import { ToastProvider } from "./providers/ToastProvider"
import ErrorBoundary from "./components/utils/ErrorBoundary"
import { PillStyleProvider } from "./contexts/PillStyleContext"
import { DateFormatProvider } from "./contexts/DateFormatContext"
import { PWAProvider } from "./providers/PWAProvider"
import FeatureFlagListener from "./components/utils/FeatureFlagListener"
// Removed SlateEarlyPatch - no longer needed with SimpleEditor
import CacheInitializer from "./components/utils/CacheInitializer"
import CacheInvalidationInitializer from "./components/utils/CacheInvalidationInitializer"
import { SyncQueueProvider } from "./contexts/SyncQueueContext"
import { LineSettingsProvider } from "./contexts/LineSettingsContext"
import ConsoleErrorLogger from "./components/utils/ConsoleErrorLogger"
import DoubleClickZoomPrevention from "./components/utils/DoubleClickZoomPrevention"
import TerminalConsole from "./components/utils/TerminalConsole"



// Import polyfills for browser compatibility
import "intl-segmenter-polyfill"

const ClientLayout = dynamic(() => import("./ClientLayout"), { ssr: true })

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: {
    default: "WeWrite - The Social Wiki Where Every Page is a Fundraiser",
    template: "%s | WeWrite"
  },
  description: "Create, collaborate, and share your writing with others in real-time. Join the social wiki where every page is a fundraiser and writers can earn from their content. Features real-time collaborative editing, trending content discovery, user leaderboards, group collaboration, and comprehensive activity feeds.",
  keywords: "collaborative writing, social wiki, fundraising, content creation, real-time collaboration, writing platform, community writing, online editor, collaborative documents, content monetization, writer community, social content platform, wiki platform, fundraising platform, collaborative editing, real-time editing, content sharing, writer tools, online writing, collaborative platform",
  authors: [{ name: "WeWrite Team" }],
  creator: "WeWrite",
  publisher: "WeWrite",
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
    title: "WeWrite - The Social Wiki Where Every Page is a Fundraiser",
    description: "Create, collaborate, and share your writing with others in real-time. Join the social wiki where every page is a fundraiser and writers can earn from their content.",
    url: process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app',
    siteName: 'WeWrite',
    type: 'website',
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app'}/images/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'WeWrite - Collaborative Writing Platform',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "WeWrite - The Social Wiki Where Every Page is a Fundraiser",
    description: "Create, collaborate, and share your writing with others in real-time. Join the social wiki where every page is a fundraiser and writers can earn from their content.",
    images: [`${process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app'}/images/og-image.png`],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32' },
    ],
    apple: { url: '/icons/apple-touch-icon.png', sizes: '180x180' },
  },
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="canonical" href={process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app'} />
        {/* Removed SlateEarlyPatch - no longer needed with SimpleEditor */}

        {/* Enhanced Website Schema Markup */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'WeWrite',
              alternateName: 'WeWrite App',
              description: 'The social wiki where every page is a fundraiser. Create, collaborate, and share your writing with others in real-time.',
              url: process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app',
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app'}/search?q={search_term_string}`
                },
                'query-input': 'required name=search_term_string'
              },
              publisher: {
                '@type': 'Organization',
                name: 'WeWrite',
                url: process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app',
                logo: {
                  '@type': 'ImageObject',
                  url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app'}/images/og-image.png`,
                  width: 1200,
                  height: 630
                },
                sameAs: [
                  `${process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app'}/about`,
                  `${process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app'}/features`
                ]
              },
              mainEntity: {
                '@type': 'SoftwareApplication',
                name: 'WeWrite',
                applicationCategory: 'BusinessApplication',
                operatingSystem: 'Web Browser',
                offers: {
                  '@type': 'Offer',
                  price: '0',
                  priceCurrency: 'USD'
                },
                featureList: [
                  'Real-time collaborative editing',
                  'Page-based fundraising system',
                  'Trending content discovery',
                  'User leaderboards and reputation',
                  'Group collaboration spaces',
                  'Activity tracking and feeds',
                  'Multiple reading modes',
                  'Responsive design'
                ]
              }
            })
          }}
        />
        <script dangerouslySetInnerHTML={{
          __html: `
            // Enhanced script to detect and recover from blank pages and script failures
            window.addEventListener('load', function() {
              // SCROLL RESTORATION FIX: Ensure page starts at top on load
              // This is a fallback in case other scroll restoration methods fail
              if (window.scrollY > 0) {
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                console.log('Root layout: Fallback scroll to top executed');
              }

              // Track script loading failures
              window.scriptFailures = window.scriptFailures || [];

              // Override console.error to catch script loading failures
              var originalError = console.error;
              console.error = function() {
                var args = Array.prototype.slice.call(arguments);
                var message = args.join(' ');

                // Check for common script loading failure patterns
                if (message.includes('ERR_BLOCKED_BY_CLIENT') ||
                    message.includes('Failed to load') ||
                    message.includes('script error') ||
                    message.includes('googleapis') ||
                    message.includes('vercel') ||
                    message.includes('gtag')) {
                  window.scriptFailures.push({
                    message: message,
                    timestamp: Date.now()
                  });

                  // Don't let script failures cause page reloads
                  console.warn('Script loading failure detected but continuing gracefully:', message);
                  return;
                }

                // Call original console.error for other errors
                originalError.apply(console, arguments);
              };

              // COMPREHENSIVE ZOOM PREVENTION: Initialize on mobile devices
              if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
                var lastTouchEnd = 0;
                var initialPinchDistance = 0;
                var isPinching = false;

                // Prevent double-tap zoom
                document.addEventListener('touchend', function(event) {
                  var now = Date.now();
                  if (event.touches.length === 0 && now - lastTouchEnd <= 300) {
                    event.preventDefault();
                  }
                  lastTouchEnd = now;

                  // Reset pinch detection when all touches end
                  if (event.touches.length < 2) {
                    isPinching = false;
                    initialPinchDistance = 0;
                  }
                }, { passive: false });

                // Prevent pinch-to-zoom
                document.addEventListener('touchstart', function(event) {
                  if (event.touches.length >= 2) {
                    var touch1 = event.touches[0];
                    var touch2 = event.touches[1];
                    var deltaX = touch2.clientX - touch1.clientX;
                    var deltaY = touch2.clientY - touch1.clientY;
                    initialPinchDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                    isPinching = true;
                  }
                }, { passive: false });

                document.addEventListener('touchmove', function(event) {
                  if (event.touches.length >= 2 && isPinching) {
                    var touch1 = event.touches[0];
                    var touch2 = event.touches[1];
                    var deltaX = touch2.clientX - touch1.clientX;
                    var deltaY = touch2.clientY - touch1.clientY;
                    var currentDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                    var distanceChange = Math.abs(currentDistance - initialPinchDistance);

                    // Prevent if significant distance change (zoom gesture)
                    if (distanceChange > 10) {
                      event.preventDefault();
                    }
                  }
                }, { passive: false });

                // Allow keyboard zoom shortcuts (Ctrl/Cmd + Plus/Minus)
                // Only prevent trackpad zoom gestures
                document.addEventListener('wheel', function(event) {
                  if (event.ctrlKey || event.metaKey) {
                    // Prevent trackpad zoom (small deltaY values)
                    var isTrackpadGesture = Math.abs(event.deltaY) < 50 && event.deltaX === 0;
                    if (isTrackpadGesture) {
                      event.preventDefault();
                    }
                  }
                }, { passive: false });

                console.log('Comprehensive zoom prevention initialized (keyboard zoom allowed)');
              }

              // CRITICAL FIX: Blank page detection DISABLED to prevent infinite refresh loops
              // This was the PRIMARY CAUSE of the infinite refresh issue affecting users

              // NO AUTOMATIC RELOAD - this was causing the infinite refresh loop
            });
          `
        }} />
      </head>
      <body className={inter.className}>
          <ErrorBoundary name="root" resetOnPropsChange={true}>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
            <ErrorBoundary name="auth" resetOnPropsChange={true}>
              <AuthProvider>
                <ErrorBoundary name="app" resetOnPropsChange={true}>
                  <AppProvider>
                    <ErrorBoundary name="data" resetOnPropsChange={true}>
                      <DataProvider>
                        <ErrorBoundary name="analytics" resetOnPropsChange={false}>
                          <UnifiedAnalyticsProvider>
                              <ToastProvider>
                                <PillStyleProvider>
                                  <DateFormatProvider>
                                    <LineSettingsProvider>
                                      <PWAProvider>
                                        <SyncQueueProvider>
                                        <CacheInitializer />
                                        <CacheInvalidationInitializer />
                                        <ConsoleErrorLogger />
                                        <TerminalConsole />
                                        <DoubleClickZoomPrevention />
                                        <FeatureFlagListener>
                                          <ErrorBoundary name="layout" resetOnPropsChange={true}>
                                            <ClientLayout>
                                              {children}
                                            </ClientLayout>
                                          </ErrorBoundary>
                                        </FeatureFlagListener>
                                        <ErrorBoundary name="vercel_analytics" resetOnPropsChange={false}>
                                          <Analytics debug={process.env.NODE_ENV === 'development'} />
                                        </ErrorBoundary>
                                        <ErrorBoundary name="speed_insights" resetOnPropsChange={false}>
                                          <SpeedInsights />
                                        </ErrorBoundary>

                                      </SyncQueueProvider>
                                      </PWAProvider>
                                    </LineSettingsProvider>
                                  </DateFormatProvider>
                                </PillStyleProvider>
                              </ToastProvider>
                          </UnifiedAnalyticsProvider>
                        </ErrorBoundary>
                      </DataProvider>
                    </ErrorBoundary>
                  </AppProvider>
                </ErrorBoundary>
              </AuthProvider>
            </ErrorBoundary>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}