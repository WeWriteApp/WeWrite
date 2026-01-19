'use client';

import { Icon } from '@/components/ui/Icon';
import { socialLinks, SocialPlatform } from '@/config/social-links';

// Platform-specific icons
function PlatformIcon({ platform, size = 18 }: { platform: SocialPlatform; size?: number }) {
  switch (platform) {
    case 'x':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'threads':
      return (
        <svg viewBox="0 0 192 192" width={size} height={size} fill="currentColor" aria-hidden="true">
          <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.742C35.236 139.966 29.808 120.682 29.605 96c.203-24.682 5.63-43.966 16.133-57.317C56.954 24.425 74.204 17.11 97.013 16.94c23.003.173 40.478 7.54 51.913 21.896 5.625 7.062 9.882 15.87 12.721 26.2l15.717-4.255c-3.391-12.464-8.748-23.138-16.016-31.99C146.596 10.395 124.96 1.143 97.059.94h-.114C68.867 1.142 47.12 10.343 32.247 28.636 15.933 48.648 7.66 76.17 7.426 95.943L7.421 96l.005.057c.234 19.773 8.507 47.295 24.821 67.307 14.873 18.293 36.62 27.494 64.698 27.696h.114c24.888-.163 42.339-6.704 56.505-21.182 18.605-19.03 17.567-42.153 11.313-56.765-4.49-10.5-12.632-18.996-23.34-24.125zm-40.71 44.892c-10.44.572-21.308-4.1-21.821-13.727-.38-7.142 5.052-15.106 22.827-16.13 1.995-.115 3.954-.168 5.879-.168 6.236 0 12.083.606 17.416 1.772-1.978 24.2-13.862 27.59-24.3 28.253z" />
        </svg>
      );
    case 'instagram':
      return <Icon name="Instagram" size={size} />;
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
        </svg>
      );
    case 'youtube':
      return <Icon name="Youtube" size={size} />;
    case 'twitch':
      return <Icon name="Twitch" size={size} />;
    case 'telegram':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      );
    case 'github':
      return <Icon name="Github" size={size} />;
    case 'gab':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
          <path d="M12.021 0C5.398 0 .033 5.373.033 12s5.365 12 11.988 12c2.97 0 5.681-1.087 7.768-2.887a1.058 1.058 0 0 0 .093-1.492l-.674-.78a1.045 1.045 0 0 0-1.444-.104 9.322 9.322 0 0 1-5.743 1.97c-5.168 0-9.358-4.19-9.358-9.358s4.19-9.36 9.358-9.36c2.616 0 4.974 1.075 6.67 2.808l-4.598 4.597v-.002a3.992 3.992 0 0 0-2.072-.579 4.004 4.004 0 1 0 3.24 6.333l4.742 4.742a1.05 1.05 0 0 0 1.483 0l.707-.707a1.05 1.05 0 0 0 0-1.483l-4.434-4.434 5.796-5.796a1.05 1.05 0 0 0 0-1.483l-.708-.707a1.05 1.05 0 0 0-1.482 0l-1.123 1.123A11.913 11.913 0 0 0 12.021 0z" />
        </svg>
      );
    default:
      return <Icon name="Link" size={size} />;
  }
}

export default function FollowUsPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
        {socialLinks.map((link) => (
          <a
            key={link.platform}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/50 transition-colors bg-card"
          >
            <div className="flex items-center gap-3">
              <PlatformIcon platform={link.platform} size={18} />
              <div className="flex flex-col">
                <span className="font-medium">{link.label}</span>
                <span className="text-sm text-muted-foreground">{link.handle}</span>
              </div>
            </div>
            <Icon name="ExternalLink" size={14} className="text-muted-foreground" />
          </a>
        ))}
      </div>
    </div>
  );
}
