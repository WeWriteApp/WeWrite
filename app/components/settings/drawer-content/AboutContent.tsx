'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import FeedbackModal from '../../layout/FeedbackModal';
import { getSocialUrl } from '@/config/social-links';
import { useGlobalDrawer } from '@/providers/GlobalDrawerProvider';

interface AboutLink {
  href: string;
  label: string;
  icon: string;
  external?: boolean;
  onClick?: () => void;
  navigateTo?: string; // For in-drawer navigation
}

interface AboutContentProps {
  onClose?: () => void;
}

export default function AboutContent({ onClose }: AboutContentProps) {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const { navigateInDrawer } = useGlobalDrawer();

  const aboutLinks: AboutLink[] = [
    { href: "/zRNwhNgIEfLFo050nyAT", label: "Feature Roadmap", icon: 'Map' },
    { href: "/sUASL4gNdCMVHkr7Qzty", label: "About us", icon: 'Info' },
    { href: "#", label: "Feedback", icon: 'MessageSquare', onClick: () => setShowFeedbackModal(true) },
    { href: "/credits", label: "Credits", icon: 'Heart' },
    { href: "/privacy", label: "Privacy", icon: 'Shield' },
    { href: "/terms", label: "Terms", icon: 'FileText' },
    { href: "mailto:support@getwewrite.app", label: "Email support", icon: 'Mail', external: true },
    { href: "#", label: "Follow us", icon: 'Users', navigateTo: 'about/follow-us' },
    { href: getSocialUrl('github') || 'https://github.com/WeWriteApp/WeWrite', label: "Source code", icon: 'Code', external: true },
  ];

  const renderIcon = (iconName: string) => {
    return <Icon name={iconName} size={16} />;
  };

  return (
    <>
      <div className="px-4 pb-6">
        <div className="divide-y divide-border">
          {aboutLinks.map((link, index) => (
            link.onClick ? (
              <button
                key={index}
                onClick={link.onClick}
                className="w-full flex items-center gap-3 px-3 py-4 text-left hover:bg-muted/50 transition-colors"
              >
                {renderIcon(link.icon)}
                <span className="font-medium">{link.label}</span>
              </button>
            ) : link.navigateTo ? (
              <button
                key={index}
                onClick={() => navigateInDrawer(link.navigateTo!)}
                className="w-full flex items-center justify-between px-3 py-4 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {renderIcon(link.icon)}
                  <span className="font-medium">{link.label}</span>
                </div>
                <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
              </button>
            ) : link.external ? (
              <a
                key={index}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-3 py-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {renderIcon(link.icon)}
                  <span className="font-medium">{link.label}</span>
                </div>
                <Icon name="ExternalLink" size={14} className="text-muted-foreground" />
              </a>
            ) : (
              <Link
                key={index}
                href={link.href}
                className="w-full flex items-center gap-3 px-3 py-4 hover:bg-muted/50 transition-colors"
                onClick={onClose}
              >
                {renderIcon(link.icon)}
                <span className="font-medium">{link.label}</span>
              </Link>
            )
          ))}
        </div>
      </div>

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />
    </>
  );
}
