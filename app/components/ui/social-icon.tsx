import { Youtube, Instagram, Twitter } from "lucide-react";

interface SocialIconProps {
  platform: string;
  className?: string;
}

export function SocialIcon({ platform, className = "mr-2 h-4 w-4" }: SocialIconProps) {
  switch (platform) {
    case 'twitter':
      return <Twitter className={className} />;
    case 'youtube':
      return <Youtube className={className} />;
    case 'instagram':
      return <Instagram className={className} />;
    default:
      return null;
  }
} 