"use client";

import React from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { ExternalLink, Twitter, Heart } from 'lucide-react';
import { openExternalLink } from '../../utils/pwa-detection';

interface DisabledLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DisabledLinkModal({ isOpen, onClose }: DisabledLinkModalProps) {
  const handleFollowOnX = () => {
    // Open WeWrite's X/Twitter account in a new tab
    window.open('https://twitter.com/WeWriteApp', '_blank', 'noopener,noreferrer');
  };

  const handleDonateOnOpenCollective = () => {
    // Open WeWrite's OpenCollective page in a new tab
    openExternalLink('https://opencollective.com/wewrite-app', 'Disabled Link Modal Donation');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Link Functionality Temporarily Disabled"
      className="sm:max-w-md"
    >
      <div className="space-y-4">
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
            className="w-full flex items-center gap-2 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 border-0 text-white rounded-2xl"
          >
            <Heart className="h-4 w-4" />
            Support WeWrite
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>

          <Button
            onClick={handleFollowOnX}
            variant="outline"
            className="w-full flex items-center gap-2 rounded-2xl"
          >
            <Twitter className="h-4 w-4" />
            Follow us on X for updates
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>

          <Button
            onClick={onClose}
            variant="outline"
            className="w-full rounded-2xl"
          >
            Got it
          </Button>
        </div>
      </div>
    </Modal>
  );
}