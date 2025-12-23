"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { useAuth } from "../../providers/AuthProvider";
import { usePathname } from "next/navigation";
import FeedbackModal from "./FeedbackModal";

interface SiteFooterProps {
  className?: string;
}

interface FooterLink {
  href: string;
  label: string;
  icon: string;
  external?: boolean;
  section: 'navigation' | 'content' | 'external';
  onClick?: () => void;
}

/**
 * Global site footer with navigation and content page links.
 * Excludes settings pages and settings subpages.
 * Positioned at bottom of pages without interfering with floating elements.
 */
export default function SiteFooter({ className = "" }: SiteFooterProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Don't show footer on specific pages where it would interfere
  // (currently no exclusions - footer shows everywhere including settings)

  // All footer links (content pages and external links only)
  const footerLinks: FooterLink[] = [
    { href: "/zRNwhNgIEfLFo050nyAT", label: "Feature Roadmap", icon: 'Map', section: 'content' },
    { href: "/sUASL4gNdCMVHkr7Qzty", label: "About us", icon: 'Info', section: 'content' },
    { href: "#", label: "Feedback", icon: 'MessageSquare', section: 'content', onClick: () => setShowFeedbackModal(true) },
    { href: "/credits", label: "Credits", icon: 'Heart', section: 'content' },
    { href: "/privacy", label: "Privacy", icon: 'Shield', section: 'content' },
    { href: "/terms", label: "Terms", icon: 'Scale', section: 'content' },
    { href: "mailto:support@getwewrite.app", label: "Email support", icon: 'Mail', external: true, section: 'external' },
    { href: "https://x.com/WeWriteApp", label: "Follow on X", icon: 'X', external: true, section: 'external' },
    { href: "https://github.com/WeWriteApp/WeWrite", label: "Source code", icon: 'Code', external: true, section: 'external' },
  ];

  return (
    <>
      <footer className={`w-full py-6 px-4 border-t border-border mt-12 pb-10 ${className}`}>
        <div className="container mx-auto">
          {/* All footer links in a centered wrapped list */}
          <div className="flex flex-wrap justify-center gap-x-2 gap-y-2">
            {footerLinks.map((link, index) => (
              link.onClick ? (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={link.onClick}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Icon name={link.icon} size={14} />
                  {link.label}
                </Button>
              ) : link.external ? (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  asChild
                  className="text-muted-foreground hover:text-foreground"
                >
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name={link.icon} size={14} />
                    {link.label}
                  </a>
                </Button>
              ) : (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  asChild
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Link href={link.href}>
                    <Icon name={link.icon} size={14} />
                    {link.label}
                  </Link>
                </Button>
              )
            ))}
          </div>
        </div>
      </footer>

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />
    </>
  );
}
