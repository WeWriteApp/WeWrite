"use client";

import * as React from "react";
import Modal from "./ui/modal";
import { Button } from "./ui/button";
import { SocialIcon } from "./ui/social-icon";
import { socialLinks } from "../config/social-links";
import { DollarSign } from "lucide-react";

const PledgeBarModal = ({ isOpen, onClose, isSignedIn, customContent }) => {
  // Use customContent if provided, otherwise use default content based on sign-in status
  const content = customContent || (isSignedIn ? {
    title: "This feature is coming soon!",
    description: "Soon you'll be able to tip to each page from your monthly subscription! We're still building this functionality, and if you'd like to help us get there sooner, you can support us on OpenCollective!",
    action: {
      href: "https://opencollective.com/wewrite-app",
      label: "Support us",
      external: true
    }
  } : {
    title: "Log in to support this writer",
    description: "Support your favorite writers with monthly donations that help them continue creating great content.",
    action: {
      href: "/auth/login",
      label: "Log in",
      external: false
    }
  });

  // No social links in the login modal

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={content.title}
      className="max-w-sm sm:max-w-md"
      footer={
        <div className="flex justify-center w-full pt-2">
          <Button variant="outline" onClick={onClose}>
            Dismiss
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Description */}
        <p className="text-sm text-muted-foreground">
          {content.description}
        </p>

        {/* Action Button */}
        <div>
          <Button
            asChild
            className={`w-full ${isSignedIn ? 'bg-gradient-to-r from-green-500 via-blue-500 to-green-500 hover:from-green-600 hover:via-blue-600 hover:to-green-600 text-white animate-gradient bg-[length:200%_auto]' : ''}`}
            size="lg"
            variant={isSignedIn ? "default" : "outline"}
          >
            <a
              href={content.action.href}
              target={content.action.external ? "_blank" : undefined}
              rel={content.action.external ? "noopener noreferrer" : undefined}
              className="flex items-center justify-center gap-2"
            >
              {isSignedIn && <DollarSign className="h-4 w-4 text-white" />}
              {content.action.label}
            </a>
          </Button>
        </div>

        {/* No social links section */}
      </div>
    </Modal>
  );
};

export default PledgeBarModal;