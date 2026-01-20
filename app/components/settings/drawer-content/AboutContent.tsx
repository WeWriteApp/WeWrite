'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import FeedbackModal from '../../layout/FeedbackModal';
import { useGlobalDrawer } from '@/providers/GlobalDrawerProvider';
import { ABOUT_LINKS } from '@/constants/about-links';

interface AboutContentProps {
  onClose?: () => void;
}

export default function AboutContent({ onClose }: AboutContentProps) {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const { navigateInDrawer } = useGlobalDrawer();

  const renderIcon = (iconName: string) => {
    return <Icon name={iconName} size={16} />;
  };

  return (
    <>
      <div className="px-4 pb-6">
        <div className="divide-y divide-border">
          {ABOUT_LINKS.map((link) => (
            link.isAction ? (
              <button
                key={link.id}
                onClick={() => {
                  if (link.id === 'feedback') {
                    setShowFeedbackModal(true);
                  }
                }}
                className="w-full flex items-center gap-3 px-3 py-4 text-left hover:bg-muted/50 transition-colors"
              >
                {renderIcon(link.icon)}
                <span className="font-medium">{link.label}</span>
              </button>
            ) : link.drawerPath ? (
              <button
                key={link.id}
                onClick={() => navigateInDrawer(link.drawerPath!)}
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
                key={link.id}
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
                key={link.id}
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
