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

// Threads logo SVG component (official @ symbol style)
function ThreadsLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 192 192"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.68 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.742C35.236 139.966 29.808 120.682 29.605 96c.203-24.682 5.63-43.966 16.133-57.317C56.954 24.425 74.204 17.11 97.013 16.94c23.003.173 40.568 7.515 52.198 21.82 5.568 6.85 9.77 15.16 12.55 24.782l14.853-3.976c-3.325-11.603-8.596-21.706-15.77-30.14C146.07 12.16 124.607 3.12 97.054 2.94h-.08C69.444 3.12 48.259 12.199 33.817 29.582 17.612 49.143 9.406 76.457 9.163 96.03L9.16 96l.003.03c.243 19.572 8.45 46.885 24.654 66.446 14.442 17.383 35.627 26.46 63.197 26.643h.08c24.65-.163 42.011-6.756 56.335-21.072 18.795-18.788 17.996-41.814 12.108-55.542-4.217-9.833-12.092-18.003-22.747-23.589l.747.072Zm-43.282 40.678c-10.44.57-21.284-4.1-21.848-14.703-.417-7.83 5.532-16.567 25.35-17.712 2.218-.127 4.39-.19 6.517-.19 6.266 0 12.13.548 17.448 1.614-1.978 27.503-17.055 30.418-27.467 30.99Z" />
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

// Gab logo SVG component (letter G in circle)
function GabLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
      <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor" fontFamily="system-ui, sans-serif">G</text>
    </svg>
  );
}

// Twitch logo SVG component
function TwitchLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
    </svg>
  );
}

// Telegram logo SVG component
function TelegramLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

// Substack logo SVG component
function SubstackLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/>
    </svg>
  );
}

/**
 * Map of platform to icon render function.
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
    case 'gab':
      return <GabLogo size={size} />;
    case 'twitch':
      return <TwitchLogo size={size} />;
    case 'telegram':
      return <TelegramLogo size={size} />;
    case 'substack':
      return <SubstackLogo size={size} />;
    default:
      return null;
  }
}

/**
 * Get display name for each platform
 */
function getPlatformDisplayName(platform: SocialPlatform): string {
  switch (platform) {
    case 'instagram':
      return 'Instagram';
    case 'threads':
      return 'Threads';
    case 'x':
      return 'X';
    case 'tiktok':
      return 'TikTok';
    case 'youtube':
      return 'YouTube';
    case 'github':
      return 'GitHub';
    case 'gab':
      return 'Gab';
    case 'twitch':
      return 'Twitch';
    case 'telegram':
      return 'Telegram';
    case 'substack':
      return 'Substack';
    default:
      return platform;
  }
}

/**
 * SocialIconsGrid Component
 *
 * "Follow us for updates!" section with grid layout and text labels.
 * Uses centralized social links configuration, excludes GitHub (shown in Open Source section).
 */
export default function SocialIconsGrid() {
  const colors = useLandingColors();

  // Filter out GitHub since we have a dedicated Open Source section for it
  const filteredLinks = socialLinks.filter(link => link.platform !== 'github');

  return (
    <section className="py-12">
      <div className="container mx-auto px-6 max-w-4xl">
        <div className="flex flex-col items-center gap-8">
          <h2
            className="text-3xl md:text-4xl font-bold text-center"
            style={{ color: colors.cardText }}
          >
            Follow us for updates!
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-4 md:gap-8 max-w-4xl">
            {filteredLinks.map((link) => (
              <a
                key={link.platform}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-3 p-4 rounded-xl transition-all duration-200 hover:bg-foreground/5 hover:scale-105"
                style={{
                  color: colors.cardTextMuted,
                }}
                aria-label={link.label}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: colors.cardBorder,
                  }}
                >
                  {renderPlatformIcon(link.platform, 28)}
                </div>
                <span className="text-sm font-medium text-center">
                  {getPlatformDisplayName(link.platform)}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
