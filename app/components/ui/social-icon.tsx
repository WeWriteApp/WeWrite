import { Youtube, Instagram, Twitter } from "lucide-react";

interface SocialIconProps {
  platform: string;
  className?: string;
}

export function SocialIcon({ platform, className = "mr-2 size-4" }: SocialIconProps) {
  // Use current text color for better visibility in both light and dark modes
  const iconClassName = `${className} text-current`;

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