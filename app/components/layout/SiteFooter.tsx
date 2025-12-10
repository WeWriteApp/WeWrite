"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  X, Heart, Map, Info, MessageSquare, Code, Home, Search,
  Shuffle, TrendingUp, Clock, Bell, User, Settings, Mail
} from 'lucide-react';
import { useAuth } from "../../providers/AuthProvider";
import { usePathname } from "next/navigation";
import FeedbackModal from "./FeedbackModal";

interface SiteFooterProps {
  className?: string;
}

interface FooterLink {
  href: string;
  label: string;
  icon: React.ReactNode;
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

  // Don't show footer on settings pages and settings subpages
  if (pathname.startsWith('/settings/')) {
    return null;
  }

  // All footer links (content pages and external links only)
  const footerLinks: FooterLink[] = [
    { href: "/zRNwhNgIEfLFo050nyAT", label: "Feature Roadmap", icon: <Map className="h-3 w-3" />, section: 'content' },
    { href: "/sUASL4gNdCMVHkr7Qzty", label: "About us", icon: <Info className="h-3 w-3" />, section: 'content' },
    { href: "#", label: "Feedback", icon: <MessageSquare className="h-3 w-3" />, section: 'content', onClick: () => setShowFeedbackModal(true) },
    { href: "mailto:support@getwewrite.app", label: "Email support", icon: <Mail className="h-3 w-3" />, external: true, section: 'external' },
    { href: "https://x.com/WeWriteApp", label: "Follow on X", icon: <X className="h-3 w-3" />, external: true, section: 'external' },
    { href: "https://github.com/WeWriteApp/WeWrite", label: "Source code", icon: <Code className="h-3 w-3" />, external: true, section: 'external' },
  ];

  return (
    <>
      <footer className={`w-full py-6 px-4 border-t border-neutral-20 mt-12 pb-10 ${className}`}>
        <div className="container mx-auto">
          {/* All footer links in a centered wrapped list */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
            {footerLinks.map((link, index) => (
              link.onClick ? (
                <button
                  key={index}
                  onClick={link.onClick}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 group"
                >
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {link.icon}
                  </span>
                  <span>{link.label}</span>
                </button>
              ) : (
                <Link
                  key={index}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 group"
                >
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {link.icon}
                  </span>
                  <span>{link.label}</span>
                </Link>
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
