/**
 * Central configuration for all WeWrite social media links.
 * Update URLs here to change them across the entire app.
 */

export type SocialPlatform = 'instagram' | 'threads' | 'x' | 'tiktok' | 'github' | 'youtube' | 'twitch' | 'telegram';

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
  handle: string;
  label: string;
}

/**
 * All WeWrite social media accounts.
 * Order determines display order in UI components.
 */
export const socialLinks: SocialLink[] = [
  {
    platform: 'instagram',
    url: 'https://www.instagram.com/getwewrite/',
    handle: '@getwewrite',
    label: 'Follow on Instagram'
  },
  {
    platform: 'threads',
    url: 'https://www.threads.com/@getwewrite',
    handle: '@getwewrite',
    label: 'Follow on Threads'
  },
  {
    platform: 'x',
    url: 'https://x.com/WeWriteApp',
    handle: '@WeWriteApp',
    label: 'Follow on X'
  },
  {
    platform: 'tiktok',
    url: 'https://www.tiktok.com/@wewriteapp',
    handle: '@wewriteapp',
    label: 'Follow on TikTok'
  },
  {
    platform: 'youtube',
    url: 'https://www.youtube.com/@WeWriteApp/',
    handle: '@WeWriteApp',
    label: 'Subscribe on YouTube'
  },
  {
    platform: 'twitch',
    url: 'https://www.twitch.tv/wewriteapp',
    handle: 'wewriteapp',
    label: 'Watch on Twitch'
  },
  {
    platform: 'telegram',
    url: 'https://t.me/wewriteapp',
    handle: '@wewriteapp',
    label: 'Join on Telegram'
  },
  {
    platform: 'github',
    url: 'https://github.com/WeWriteApp/WeWrite',
    handle: 'WeWriteApp/WeWrite',
    label: 'View on GitHub'
  }
];

/**
 * Get a specific social link by platform.
 */
export function getSocialLink(platform: SocialPlatform): SocialLink | undefined {
  return socialLinks.find(link => link.platform === platform);
}

/**
 * Get URL for a specific platform.
 */
export function getSocialUrl(platform: SocialPlatform): string | undefined {
  return getSocialLink(platform)?.url;
}
