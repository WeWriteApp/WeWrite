import { Icon } from "@/components/ui/Icon";

interface SocialIconProps {
  platform: string;
  className?: string;
}

export function SocialIcon({ platform, className = "text-white" }: SocialIconProps) {
  switch (platform) {
    case 'twitter':
      return <Icon name="Twitter" size={16} className={className} />;
    case 'youtube':
      return <Icon name="Youtube" size={16} className={className} />;
    case 'instagram':
      return <Icon name="Instagram" size={16} className={className} />;
    default:
      return null;
  }
}
