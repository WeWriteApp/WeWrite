"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogClose,
  DialogHeader,
  DialogFooter,
  DialogOverlay,
  DialogPortal,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { SocialIcon } from "./ui/social-icon";
import { socialLinks } from "../config/social-links";
import { DollarSign } from "lucide-react";
import "../styles/gradient-button.css";
import "../styles/modal-animations.css";

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
    title: "Sign in Required",
    description: "To donate, you must sign in first.",
    action: {
      href: "/auth/login",
      label: "Sign in",
      external: false
    }
  });

  // Sort social links in the specified order: twitter, youtube, instagram
  const sortedSocialLinks = [...socialLinks].sort((a, b) => {
    const order = { twitter: 1, youtube: 2, instagram: 3 };
    return order[a.platform] - order[b.platform];
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        <DialogOverlay className="support-modal-overlay" />
        <DialogContent
          className="max-w-sm sm:max-w-md mx-auto rounded-lg border-border dark:border-border support-modal"
          hideCloseButton
        >

        <DialogHeader>
          <DialogTitle>
            {content.title}
          </DialogTitle>
          <DialogDescription>
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-3">
          <Button
            asChild
            className={`w-full ${isSignedIn ? 'animated-gradient-button' : ''}`}
            size="lg"
            variant={isSignedIn ? "default" : "outline"}
          >
            <a
              href={content.action.href}
              target={content.action.external ? "_blank" : undefined}
              rel={content.action.external ? "noopener noreferrer" : undefined}
              className="flex items-center justify-center gap-2"
            >
              {isSignedIn && <DollarSign className="h-4 w-4" />}
              {content.action.label}
            </a>
          </Button>
        </div>

        {/* Social Links Section */}
        <div className="pt-4 border-t-only">
          <h3 className="text-sm font-medium mb-3 text-center">Follow us for updates</h3>
          <div className="flex justify-center gap-4 w-full">
            {sortedSocialLinks.map((link) => (
              <Button
                key={link.platform}
                variant="outline"
                size="icon"
                asChild
                className="rounded-full border-2 h-10 w-10 p-0"
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.label}
                  aria-label={link.label}
                >
                  <SocialIcon platform={link.platform} className="h-5 w-5" />
                </a>
              </Button>
            ))}
          </div>
        </div>

        <div className="pt-4 mt-2 border-t-only">
          <DialogFooter className="sm:justify-center pt-2">
            <DialogClose asChild>
              <Button variant="outline">
                Dismiss
              </Button>
            </DialogClose>
          </DialogFooter>
        </div>
      </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};

export default PledgeBarModal;