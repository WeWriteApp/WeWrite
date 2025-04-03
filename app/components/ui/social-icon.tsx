import { Youtube, Instagram, Twitter } from "lucide-react";

interface SocialIconProps {
  platform: string;
  className?: string;
}

export function SocialIcon({ platform, className = "mr-2 size-4" }: SocialIconProps) {
  // All icons will be white for better visibility against colored backgrounds
  const iconClassName = `${className} text-white`;

  switch (platform) {
    case 'twitter':
      return <Twitter className={iconClassName} />;
    case 'youtube':
      return <Youtube className={iconClassName} />;
    case 'instagram':
      return <Instagram className={iconClassName} />;
    default:
      return null;
  }
}