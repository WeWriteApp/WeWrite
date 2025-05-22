"use client";

import React from 'react';
import { Button } from './ui/button';
import { X, ExternalLink, Twitter, Heart } from 'lucide-react';
import { openExternalLink } from '../utils/pwa-detection';

interface DisabledLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DisabledLinkModal({ isOpen, onClose }: DisabledLinkModalProps) {
  if (!isOpen) return null;

  const handleFollowOnX = () => {
    // Open WeWrite's X/Twitter account in a new tab
    window.open('https://twitter.com/WeWriteApp', '_blank', 'noopener,noreferrer');
  };

  const handleDonateOnOpenCollective = () => {
    // Open WeWrite's OpenCollective page in a new tab
    openExternalLink('https://opencollective.com/wewrite-app', 'Disabled Link Modal Donation');
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-background rounded-2xl shadow-xl border border-border w-[90%] max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            Link Functionality Temporarily Disabled
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <p className="text-muted-foreground">
              We're working on fixing the link functionality. Sorry for the inconvenience - check back soon!
            </p>
            <p className="text-sm text-muted-foreground">
              Your donations help cover engineering costs and keep WeWrite running smoothly for everyone.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={handleDonateOnOpenCollective}
              variant="default"
              className="w-full flex items-center gap-2 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 border-0 text-white"
            >
              <Heart className="h-4 w-4" />
              Support WeWrite
              <ExternalLink className="h-3 w-3 ml-auto" />
            </Button>

            <Button
              onClick={handleFollowOnX}
              variant="outline"
              className="w-full flex items-center gap-2"
            >
              <Twitter className="h-4 w-4" />
              Follow us on X for updates
              <ExternalLink className="h-3 w-3 ml-auto" />
            </Button>

            <Button
              onClick={onClose}
              variant="outline"
              className="w-full"
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
