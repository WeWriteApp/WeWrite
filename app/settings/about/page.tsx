'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import FeedbackModal from '../../components/layout/FeedbackModal';
import { ABOUT_LINKS } from '@/constants/about-links';

export default function AboutPage() {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const renderIcon = (iconName: string) => {
    return <Icon name={iconName} size={16} />;
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {ABOUT_LINKS.map((link) => (
            link.isAction ? (
              <button
                key={link.id}
                onClick={() => {
                  if (link.id === 'feedback') {
                    setShowFeedbackModal(true);
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-muted/50 transition-colors bg-card"
              >
                {renderIcon(link.icon)}
                <span className="font-medium">{link.label}</span>
              </button>
            ) : link.hasChevron ? (
              <Link
                key={link.id}
                href={link.href}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/50 transition-colors bg-card"
              >
                <div className="flex items-center gap-3">
                  {renderIcon(link.icon)}
                  <span className="font-medium">{link.label}</span>
                </div>
                <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
              </Link>
            ) : link.external ? (
              <a
                key={link.id}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/50 transition-colors bg-card"
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
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-muted/50 transition-colors bg-card"
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
