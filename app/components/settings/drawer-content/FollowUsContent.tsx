'use client';

import { Icon } from '@/components/ui/Icon';
import { socialLinks, SocialPlatform } from '@/config/social-links';

// Platform-specific icons
// Some platforms need custom SVG icons since Lucide doesn't have them
function PlatformIcon({ platform, size = 16 }: { platform: SocialPlatform; size?: number }) {
  switch (platform) {
    case 'x':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'threads':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.332-3.023.9-.746 2.174-1.178 3.676-1.254.87-.044 1.7-.02 2.476.076-.09-.5-.252-.943-.488-1.315-.364-.573-.947-.985-1.833-1.168l.4-1.965c1.36.278 2.394.958 3.075 2.023.262.41.472.87.628 1.378.757.27 1.432.63 2.01 1.081 1.032.806 1.751 1.848 2.14 3.11.502 1.63.39 3.603-.936 4.952-1.79 1.82-4.075 2.632-7.188 2.556zm.166-6.136c-1.027.053-1.822.283-2.36.682-.465.346-.674.757-.646 1.258.028.503.262.9.695 1.18.512.332 1.238.501 2.042.458 1.12-.062 1.98-.477 2.554-1.191.434-.54.743-1.249.906-2.11-.98-.147-2.06-.21-3.191-.277z" />
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
          <path d="M21.208 3.073l-6.632 5.103-3.381-1.902-7.327 3.98v9.477l7.327 4.11 7.194-3.91-.198-4.513-3.644 1.605-3.347-1.872v-3.593l6.603-3.53L24 11.61V4.968zm-6.726 13.851l-3.294 1.844v-3.593l3.347 1.872-.053-.123zM7.195 11.866l3.328-1.817v3.594L7.195 15.46z" />
        </svg>
      );
    case 'substack':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
          <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/>
        </svg>
      );
    default:
      return <Icon name="Link" size={size} />;
  }
}

interface FollowUsContentProps {
  onClose?: () => void;
}

export default function FollowUsContent({ onClose }: FollowUsContentProps) {
  return (
    <div className="px-4 pb-6">
      <div className="divide-y divide-border">
        {socialLinks.map((link) => (
          <a
            key={link.platform}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between px-3 py-4 hover:bg-muted/50 transition-colors"
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
