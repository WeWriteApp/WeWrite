"use client";

import * as React from "react";
import Modal from "./ui/modal";
import { Button } from "./ui/button";
import { SocialIcon } from "./ui/social-icon";
import { socialLinks } from "../config/social-links";
import { DollarSign } from "lucide-react";
import { SupporterIcon } from "./SupporterIcon";

const PledgeBarModal = ({ isOpen, onClose, isSignedIn, customContent }) => {
  // Use customContent if provided, otherwise use default content based on sign-in status
  const content = customContent || (isSignedIn ? {
    title: "This feature is coming soon!",
    description: "You can help support development by activating your subscription.",
    action: {
      href: "/support",
      label: "View Subscription Tiers",
      external: false
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

        {/* Subscription Tiers - Horizontally Scrollable */}
        {isSignedIn && (
          <div className="mt-4 mb-6">
            <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
              <div className="flex space-x-3 w-max min-w-full">
                {/* Tier 1 */}
                <div className="flex-none w-[200px] p-3 rounded-lg border bg-blue-50/40 dark:bg-blue-950/10">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <SupporterIcon tier="tier1" status="active" size="lg" />
                    </div>
                    <div className="flex-grow">
                      <div className="font-medium">Tier 1 Subscription</div>
                      <div className="text-sm text-muted-foreground">$10/mo</div>
                    </div>
                  </div>
                </div>

                {/* Tier 2 */}
                <div className="flex-none w-[200px] p-3 rounded-lg border bg-blue-50/60 dark:bg-blue-950/15">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <SupporterIcon tier="tier2" status="active" size="lg" />
                    </div>
                    <div className="flex-grow">
                      <div className="font-medium">Tier 2 Subscription</div>
                      <div className="text-sm text-muted-foreground">$20/mo</div>
                    </div>
                  </div>
                </div>

                {/* Tier 3 */}
                <div className="flex-none w-[200px] p-3 rounded-lg border bg-blue-50/80 dark:bg-blue-950/20">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <SupporterIcon tier="tier3" status="active" size="lg" />
                    </div>
                    <div className="flex-grow">
                      <div className="font-medium">Tier 3 Subscription</div>
                      <div className="text-sm text-muted-foreground">$50/mo</div>
                    </div>
                  </div>
                </div>

                {/* Tier 4 */}
                <div className="flex-none w-[200px] p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/30">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <SupporterIcon tier="tier4" status="active" size="lg" />
                    </div>
                    <div className="flex-grow">
                      <div className="font-medium">Tier 4 Subscription</div>
                      <div className="text-sm text-muted-foreground">$100+/mo</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div>
          <Button
            asChild
            className={`w-full ${isSignedIn ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
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
      </div>
    </Modal>
  );
};

export default PledgeBarModal;