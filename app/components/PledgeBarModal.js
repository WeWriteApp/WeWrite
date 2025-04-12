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

const PledgeBarModal = ({ isOpen, onClose, isSignedIn, customContent, pledgeData }) => {
  // Use customContent if provided, otherwise use default content based on sign-in status and pledge data
  const content = customContent || (isSignedIn ? {
    title: pledgeData?.pageTitle || "Support this page",
    description: `Adjust your monthly support for this page. Your current pledge is $${pledgeData?.amount?.toFixed(2) || '0.00'} per month.`,
    action: {
      href: "#",
      label: "Save",
      external: false
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

        {pledgeData && (
          <div className="my-4 space-y-4">
            <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
              {/* Already spent section */}
              {pledgeData.subscription && (
                <div
                  className="h-full bg-gray-400 dark:bg-gray-600 float-left"
                  style={{
                    width: `${pledgeData.subscription.amount ?
                      Math.max(0, ((pledgeData.subscription.pledgedAmount || 0) - (pledgeData.amount || 0)) / pledgeData.subscription.amount * 100) : 0}%`
                  }}
                ></div>
              )}

              {/* Current pledge section */}
              {pledgeData.subscription && (
                <div
                  className="h-full bg-blue-500 dark:bg-blue-600 float-left"
                  style={{
                    width: `${pledgeData.subscription.amount ?
                      (pledgeData.amount / pledgeData.subscription.amount * 100) : 0}%`
                  }}
                ></div>
              )}
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm">
                <span className="font-medium">Current pledge:</span> ${pledgeData.amount?.toFixed(2) || '0.00'}/mo
              </div>
              <div className="text-sm">
                <span className="font-medium">Available:</span> ${pledgeData.available?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>
        )}

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
          <div className="flex flex-col gap-2 w-full">
            {sortedSocialLinks.map((link) => (
              <Button
                key={link.platform}
                variant="outline"
                asChild
                className="w-full justify-center text-foreground hover:text-foreground"
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full"
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
      </DialogPortal>
    </Dialog>
  );
};

export default PledgeBarModal;