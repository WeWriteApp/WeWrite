import React from 'react';

export function TechnicalDocs() {
  return (
    <>
      {/* Technical Notes */}
      <div className="wewrite-card bg-muted/30 mt-8">
        <h3 className="text-lg font-semibold mb-3">Technical Notes</h3>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
          <li>All OG images are generated using Next.js <code className="bg-muted px-1 rounded">ImageResponse</code> from <code className="bg-muted px-1 rounded">next/og</code></li>
          <li>Images are generated at the edge runtime for fast delivery</li>
          <li>Standard OG image size is 1200x630 pixels</li>
          <li>The <code className="bg-muted px-1 rounded">/api/og</code> route accepts query params: id, title, author, content, sponsors</li>
          <li>Content is automatically stripped of HTML tags and truncated for display</li>
        </ul>
      </div>

      {/* Implementation Documentation */}
      <div className="wewrite-card mt-8">
        <h3 className="text-lg font-semibold mb-4">Implementation Documentation</h3>

        <div className="space-y-6">
          <div>
            <h4 className="text-md font-semibold mb-2 text-primary">Design System</h4>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>All OG images follow a consistent visual language:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li><strong>Background:</strong> Solid black (#000) base</li>
                <li><strong>Gradient Blobs:</strong> 3 large blurred circles (800-900px) with 45-55% opacity, blur radius of 80px</li>
                <li><strong>Sparkles:</strong> 8 subtle white dots (2-4px) scattered at various opacities (0.5-0.9)</li>
                <li><strong>Typography:</strong> System UI font, headings at fontWeight 800, body at fontWeight 500</li>
                <li><strong>Colors:</strong> Blue (#3B82F6), Purple (#8B5CF6), Green (#22C55E) primary accents</li>
              </ul>
            </div>
          </div>

          <div>
            <h4 className="text-md font-semibold mb-2 text-primary">Layout Types</h4>
            <div className="text-sm text-muted-foreground space-y-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-medium text-foreground mb-1">Split Layout (55/45)</p>
                <p>Used for: Login, Register, Invite, Trending, Leaderboard</p>
                <p>Left side has marketing copy, right side has UI preview or cards</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-medium text-foreground mb-1">Centered Layout</p>
                <p>Used for: Search, Terms, Privacy, Welcome</p>
                <p>Icon/graphic at top, centered title and subtitle, optional action items below</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-medium text-foreground mb-1">Content Layout</p>
                <p>Used for: Dynamic page OG images (/api/og)</p>
                <p>Full-width title (72px, 3-line max), inline link pills, gradient fade to footer</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-medium text-foreground mb-1">Profile Layout</p>
                <p>Used for: User profile pages (/u/[username])</p>
                <p>Avatar + username header, bio section, gradient footer with CTA button</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-md font-semibold mb-2 text-primary">Shared Components Library</h4>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>All OG images should import from <code className="bg-muted px-1 rounded">@/app/lib/og-components</code> for consistency:</p>
              <div className="bg-muted/50 rounded-lg p-3 font-mono text-xs space-y-1">
                <p><span className="text-blue-400">OG_STYLES</span> - Design tokens (colors, fonts, sizes, shadows)</p>
                <p><span className="text-green-400">OGBlobs</span> - Gradient blob backgrounds with theme prop</p>
                <p><span className="text-purple-400">OGSparkles</span> - Subtle sparkle dots decoration</p>
                <p><span className="text-yellow-400">OGFooter</span> - WeWrite logo footer</p>
                <p><span className="text-cyan-400">ogTitleStyle / ogSubtitleStyle</span> - Typography styles</p>
                <p><span className="text-orange-400">truncateText / extractPlainText</span> - Utility functions</p>
              </div>
              <p className="text-xs mt-2">To update all OG images at once, modify the shared component file.</p>
            </div>
          </div>

          <div>
            <h4 className="text-md font-semibold mb-2 text-primary">File Locations</h4>
            <div className="text-sm text-muted-foreground">
              <div className="bg-muted/50 rounded-lg p-3 font-mono text-xs space-y-1">
                <p><span className="text-pink-400">Shared components:</span> app/lib/og-components.tsx</p>
                <p><span className="text-blue-400">Static pages:</span> app/[route]/opengraph-image.tsx</p>
                <p><span className="text-green-400">Content pages:</span> app/api/og/route.tsx</p>
                <p><span className="text-purple-400">User profiles:</span> app/u/[username]/opengraph-image.tsx</p>
                <p><span className="text-yellow-400">Auth pages:</span> app/auth/[action]/opengraph-image.tsx</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-md font-semibold mb-2 text-primary">Blob Color Themes</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-medium text-foreground mb-1">Default (Blue/Purple/Green)</p>
                <p className="text-muted-foreground">Welcome, Home, Content, User Profiles</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-medium text-foreground mb-1">Blue Tones</p>
                <p className="text-muted-foreground">Login, Register, Leaderboard, Search</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-medium text-foreground mb-1">Orange/Red</p>
                <p className="text-muted-foreground">Trending page</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-medium text-foreground mb-1">Green Accent</p>
                <p className="text-muted-foreground">Invite, Privacy pages</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-md font-semibold mb-2 text-primary">Best Practices</h4>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Always include the WeWrite logo in footer (72x72px with border)</li>
              <li>Use textShadow on headings for depth against gradient backgrounds</li>
              <li>Keep body text at 0.85-0.9 opacity for readability</li>
              <li>Blobs should overflow the canvas for seamless edges</li>
              <li>Title should be truncated to 3 lines max with overflow: hidden</li>
              <li>Test with Facebook Debugger and Twitter Card Validator after changes</li>
            </ul>
          </div>

          <div>
            <h4 className="text-md font-semibold mb-2 text-primary">Facebook &amp; Instagram Best Practices</h4>
            <div className="text-sm text-muted-foreground space-y-3">
              <p>
                Instagram uses Facebook&apos;s crawler for link previews in DMs and stories. Follow these guidelines to ensure images appear correctly:
              </p>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="font-medium text-blue-400 mb-2">Required Meta Tags</p>
                <p className="mb-2">Always specify image dimensions to avoid the &quot;images are processed asynchronously&quot; error:</p>
                <div className="bg-muted/50 rounded p-2 font-mono text-xs space-y-1">
                  <p><span className="text-green-400">og:image</span> - Full URL to the image</p>
                  <p><span className="text-green-400">og:image:width</span> - 1200 (required for immediate availability)</p>
                  <p><span className="text-green-400">og:image:height</span> - 630 (required for immediate availability)</p>
                </div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="font-medium text-yellow-400 mb-2">Precaching New URLs</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Facebook caches OG images indefinitely until manually cleared</li>
                  <li>New URLs should have <code className="bg-muted px-1 rounded">og:image:width</code> and <code className="bg-muted px-1 rounded">og:image:height</code> specified</li>
                  <li>Use the Facebook Sharing Debugger to &quot;Scrape Again&quot; and refresh the cache</li>
                  <li>This also clears Instagram&apos;s cache since they share the same crawler</li>
                </ul>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                <p className="font-medium text-purple-400 mb-2">Troubleshooting</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Image not showing:</strong> Use Facebook Sharing Debugger &rarr; click &quot;Scrape Again&quot;</li>
                  <li><strong>&quot;Processing asynchronously&quot; error:</strong> Add og:image:width and og:image:height meta tags</li>
                  <li><strong>Wrong image:</strong> Clear cache with Facebook Debugger, wait ~24 hours for full propagation</li>
                  <li><strong>Instagram DM not showing preview:</strong> The sender must be following the recipient, or both accounts must be public</li>
                </ul>
              </div>
              <p className="text-xs">
                Reference: <a
                  href="https://developers.facebook.com/docs/sharing/best-practices/#precaching"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Facebook Sharing Best Practices - Pre-caching Images
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
