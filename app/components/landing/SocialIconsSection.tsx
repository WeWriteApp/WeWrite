"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { useLandingColors } from './LandingColorContext';
import { socialLinks, SocialPlatform } from '@/config/social-links';

// X (Twitter) logo SVG component
function XLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// GitHub logo SVG component
function GitHubLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

// Threads logo SVG component
function ThreadsLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.17.408-2.243 1.33-3.023.88-.744 2.12-1.168 3.59-1.226 1.073-.044 2.074.07 2.99.337-.02-.933-.236-1.643-.646-2.112-.493-.566-1.275-.86-2.322-.875h-.02c-.818.008-1.927.26-2.435.885l-1.58-1.322c.907-1.108 2.406-1.676 4.015-1.682h.03c1.574.02 2.813.533 3.682 1.528.822.942 1.265 2.26 1.316 3.916.377.144.732.313 1.062.509 1.244.74 2.15 1.769 2.62 2.974.712 1.822.78 4.603-1.435 6.77-1.902 1.864-4.252 2.68-7.607 2.703zM11.096 17.88c.152.009.302.012.452.012 1.038 0 1.845-.285 2.398-.848.427-.434.709-1.042.84-1.812-.93-.253-1.927-.37-2.972-.35-1.563.055-2.527.644-2.483 1.519.021.397.249.742.64.972.455.267 1.075.453 1.77.493l-.645.014z"/>
    </svg>
  );
}

// TikTok logo SVG component
function TikTokLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  );
}

// YouTube logo SVG component
function YouTubeLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

/**
 * Map of platform to icon render function.
 * YouTube is excluded from landing page display (only shown in footer).
 */
function renderPlatformIcon(platform: SocialPlatform, size: number): React.ReactNode {
  switch (platform) {
    case 'instagram':
      return <Icon name="Instagram" size={size} />;
    case 'threads':
      return <ThreadsLogo size={size} />;
    case 'x':
      return <XLogo size={size} />;
    case 'tiktok':
      return <TikTokLogo size={size} />;
    case 'youtube':
      return <YouTubeLogo size={size} />;
    case 'github':
      return <GitHubLogo size={size} />;
    default:
      return null;
  }
}

export default function SocialIconsSection() {
  const colors = useLandingColors();

  return (
    <div className="w-full py-10">
      <div className="flex flex-col items-center gap-5">
        <p
          className="text-sm font-medium"
          style={{ color: colors.cardTextMuted }}
        >
          Follow us for updates!
        </p>
        <div className="flex items-center justify-center gap-3">
          {socialLinks.map((link) => (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-11 h-11 rounded-full flex items-center justify-center transition-colors duration-200 hover:bg-foreground/5"
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: colors.cardBorder,
                color: colors.cardTextMuted,
              }}
              aria-label={link.label}
            >
              {renderPlatformIcon(link.platform, 20)}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// Export icons for use in other components
export { XLogo, GitHubLogo, ThreadsLogo, TikTokLogo, YouTubeLogo, renderPlatformIcon };
