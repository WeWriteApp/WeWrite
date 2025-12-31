"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { useAuth } from "../../providers/AuthProvider";
import { usePathname } from "next/navigation";
import FeedbackModal from "./FeedbackModal";
import { getSocialUrl } from "@/config/social-links";

// X (Twitter) logo SVG component
function XLogo({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

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
    { href: "/terms", label: "Terms", icon: 'FileText', section: 'content' },
    { href: "mailto:support@getwewrite.app", label: "Email support", icon: 'Mail', external: true, section: 'external' },
    { href: getSocialUrl('x') || 'https://x.com/WeWriteApp', label: "Follow on X", icon: 'XLogo', external: true, section: 'external' },
    { href: getSocialUrl('github') || 'https://github.com/WeWriteApp/WeWrite', label: "Source code", icon: 'Code', external: true, section: 'external' },
  ];

  // Helper to render icons, handling special cases like XLogo
  const renderIcon = (iconName: string) => {
    if (iconName === 'XLogo') {
      return <XLogo size={14} />;
    }
    return <Icon name={iconName} size={14} />;
  };

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
                    {renderIcon(link.icon)}
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
