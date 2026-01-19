"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../components/ui/button';
import { ComponentShowcase, StateDemo } from './shared';

export function BannerSystemSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Banner System"
      path="app/components/layout/EmailVerificationTopBanner.tsx, app/components/utils/PWABanner.tsx"
      description="Full-width accent-colored banners for email verification and PWA installation. Fixed at top of viewport with z-[100]."
    >
      <StateDemo label="Email Verification Banner (Mobile & Desktop)">
        <div className="w-full max-w-2xl">
          <div className="h-10 bg-primary text-primary-foreground flex items-center justify-center px-3 md:px-4 rounded-lg">
            <div className="flex items-center gap-2 md:gap-4 max-w-4xl w-full justify-between">
              {/* Left: Icon + Message */}
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="Mail" size={16} className="flex-shrink-0" />
                <span className="text-xs md:text-sm font-medium truncate">
                  Please verify your email address to unlock all features
                </span>
              </div>

              {/* Right: View details button */}
              <div className="flex items-center flex-shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2 md:px-3 text-xs bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-none"
                >
                  View details
                </Button>
              </div>
            </div>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="PWA Installation Banner (Mobile Only)">
        <div className="w-full max-w-2xl">
          <div className="h-12 bg-primary text-primary-foreground flex items-center justify-center px-4 rounded-lg">
            <div className="flex items-center gap-3 max-w-4xl w-full justify-between">
              {/* Left: Icon + Message */}
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="Download" size={16} className="flex-shrink-0" />
                <span className="text-sm font-medium truncate">
                  Install WeWrite as an app
                </span>
              </div>

              {/* Right: Action buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 px-3 text-sm bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-none"
                >
                  Later
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 px-3 text-sm bg-primary-foreground hover:bg-primary-foreground/90 text-primary border-none"
                >
                  Install
                </Button>
              </div>
            </div>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Banner Button Variants">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">
            Banners use custom button styling for contrast against the accent background:
          </p>
          <div className="flex flex-wrap gap-3 p-4 bg-primary rounded-lg">
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-sm bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-none"
            >
              Secondary (subtle)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-sm bg-primary-foreground hover:bg-primary-foreground/90 text-primary border-none"
            >
              Primary (prominent)
            </Button>
          </div>
          <div className="text-xs text-muted-foreground space-y-1 mt-2">
            <p><code className="bg-muted px-1 rounded">bg-primary-foreground/20</code> - Subtle action (Later, View details)</p>
            <p><code className="bg-muted px-1 rounded">bg-primary-foreground</code> - Primary action (Install)</p>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Banner Priority System">
        <div className="wewrite-card p-4 max-w-2xl">
          <h4 className="font-medium mb-2">One Banner at a Time</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Only one banner shows at a time, following this priority order:
          </p>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside mb-4">
            <li><strong className="text-foreground">Email Verification</strong> - Highest priority, shows until verified or dismissed</li>
            <li><strong className="text-foreground">Username Setup</strong> - Shows if email verified but username invalid (card-based, not full-width)</li>
            <li><strong className="text-foreground">PWA Installation</strong> - Lowest priority, only shows when others are dismissed (mobile only)</li>
          </ol>
          <p className="text-sm text-muted-foreground">
            Managed by <code className="bg-muted px-1 rounded">BannerProvider</code> which cascades to the next banner when one is dismissed.
          </p>
        </div>
      </StateDemo>

      <StateDemo label="Banner Layout Architecture">
        <div className="wewrite-card p-4 max-w-2xl">
          <h4 className="font-medium mb-2">CSS Variable System</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Banners use CSS variables to communicate their height to the rest of the app:
          </p>
          <ul className="text-sm text-muted-foreground space-y-2 mb-4">
            <li><code className="bg-muted px-1 rounded">--email-banner-height</code> - Set by EmailVerificationTopBanner (40px when visible)</li>
            <li><code className="bg-muted px-1 rounded">--pwa-banner-height</code> - Set by PWABanner (48px when visible)</li>
          </ul>
          <h4 className="font-medium mb-2 mt-4">Content Offset Implementation</h4>
          <p className="text-sm text-muted-foreground mb-3">
            All page layouts must account for banner height. Use one of these approaches:
          </p>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>
              <strong className="text-foreground">Option 1: CSS Variable (Recommended)</strong>
              <pre className="bg-muted p-2 rounded mt-1 text-xs overflow-x-auto">
{`<div style={{ paddingTop: 'var(--email-banner-height, 0px)' }}>
  {/* Page content */}
</div>`}
              </pre>
            </li>
            <li>
              <strong className="text-foreground">Option 2: BannerProvider Hook</strong>
              <pre className="bg-muted p-2 rounded mt-1 text-xs overflow-x-auto">
{`const { bannerOffset } = useBanner();
// bannerOffset is the calculated height in pixels`}
              </pre>
            </li>
          </ul>
        </div>
      </StateDemo>

      <StateDemo label="Fixed Header Integration">
        <div className="wewrite-card p-4 max-w-2xl">
          <h4 className="font-medium mb-2">Z-Index Layering</h4>
          <ul className="text-sm text-muted-foreground space-y-1 mb-4">
            <li><code className="bg-muted px-1 rounded">z-[100]</code> - Banners (above headers)</li>
            <li><code className="bg-muted px-1 rounded">z-50</code> - Headers/Nav (below banners)</li>
            <li><code className="bg-muted px-1 rounded">z-[999]</code> - Modals/Drawers (above everything)</li>
          </ul>
          <h4 className="font-medium mb-2">Header Position Offset</h4>
          <p className="text-sm text-muted-foreground mb-2">
            Fixed headers must offset their <code className="bg-muted px-1 rounded">top</code> position to account for banners:
          </p>
          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`// In fixed-layer.css
.fixed-header-sidebar-aware {
  top: calc(var(--email-banner-height, 0px) + var(--pwa-banner-height, 0px));
}`}
          </pre>
        </div>
      </StateDemo>

      <StateDemo label="Banner Design Guidelines">
        <div className="wewrite-card p-4 max-w-2xl">
          <h4 className="font-medium mb-2">Visual Design</h4>
          <ul className="text-sm text-muted-foreground space-y-1 mb-4">
            <li>Uses <code className="bg-muted px-1 rounded">bg-primary text-primary-foreground</code> for accent-colored background</li>
            <li>Fixed position at top: <code className="bg-muted px-1 rounded">fixed top-0 left-0 right-0 z-[100]</code></li>
            <li>Email banner: 40px height, shows on all screen sizes</li>
            <li>PWA banner: 48px height, mobile only (<code className="bg-muted px-1 rounded">md:hidden</code>)</li>
          </ul>
          <h4 className="font-medium mb-2">Dismissal Behavior</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li><strong className="text-foreground">Later:</strong> Dismisses temporarily (PWA shows again after a few days)</li>
            <li><strong className="text-foreground">Don't remind:</strong> Permanently dismisses until condition changes</li>
            <li>Stored in localStorage with timestamp tracking</li>
          </ul>
        </div>
      </StateDemo>

      <StateDemo label="Adding New Banners">
        <div className="wewrite-card p-4 max-w-2xl">
          <h4 className="font-medium mb-2">Checklist for New Banners</h4>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Add state to <code className="bg-muted px-1 rounded">BannerProvider</code> with priority logic</li>
            <li>Create CSS variable: <code className="bg-muted px-1 rounded">--your-banner-height</code></li>
            <li>Update <code className="bg-muted px-1 rounded">fixed-layer.css</code> to include new variable in calculations</li>
            <li>Set the CSS variable when banner mounts/unmounts</li>
            <li>Add localStorage keys for dismissal tracking</li>
            <li>Update cascade logic in BannerProvider dismiss handlers</li>
            <li>Use <code className="bg-muted px-1 rounded">bg-primary text-primary-foreground</code> styling</li>
          </ol>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
