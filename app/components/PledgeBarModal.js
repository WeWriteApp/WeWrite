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
} from "./ui/dialog";
import { Button } from "./ui/button";
import { SocialIcon } from "./ui/social-icon";
import { socialLinks } from "../config/social-links";
import { DollarSign } from "lucide-react";

const PledgeBarModal = ({ isOpen, onClose, isSignedIn }) => {
  const content = isSignedIn ? {
    title: "Support WeWrite",
    description: "⚡️ Donations aren't built yet! Please support us on OpenCollective so we can get this built!⚡️",
    action: {
      href: "https://opencollective.com/wewrite-app/contribute/backer-77100",
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
  };

  // Sort social links in the specified order: twitter, youtube, instagram
  const sortedSocialLinks = [...socialLinks].sort((a, b) => {
    const order = { twitter: 1, youtube: 2, instagram: 3 };
    return order[a.platform] - order[b.platform];
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-sm sm:max-w-md mx-auto animate-in fade-in-90 slide-in-from-bottom-10 duration-300 rounded-lg border-border dark:border-border"
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
            className={`w-full ${isSignedIn ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
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
          <div className="flex flex-col gap-2 w-full">
            {sortedSocialLinks.map((link) => (
              <Button
                key={link.platform}
                variant="outline"
                asChild
                className={`w-full justify-center ${
                  link.platform === 'twitter'
                    ? 'bg-[#1DA1F2] hover:bg-[#1DA1F2]/90 text-white'
                    : link.platform === 'youtube'
                    ? 'bg-[#FF0000] hover:bg-[#FF0000]/90 text-white'
                    : link.platform === 'instagram'
                    ? 'bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90 text-white'
                    : ''
                }`}
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <SocialIcon platform={link.platform} className="h-5 w-5" />
                  <span>{link.label}</span>
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
    </Dialog>
  );
};

export default PledgeBarModal;