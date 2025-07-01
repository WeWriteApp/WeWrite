"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "../ui/dialog";
import { Button } from "../ui/button";
import { X, Heart, ArrowRight } from "lucide-react";
import Link from "next/link";

const SubscriptionComingSoonModal = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col rounded-lg border-theme-strong bg-card animate-in fade-in-0 zoom-in-95 duration-300">
        <DialogClose asChild>
          <Button variant="outline" size="icon" className="absolute right-4 top-4">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>

        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
              <Heart className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <DialogTitle className="text-xl">Coming Soon!</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <p className="text-center text-muted-foreground mb-8">
            Soon you'll be able to donate directly to writers! In the meantime, you can support WeWrite development through OpenCollective.
          </p>

          <div className="px-4">
            <Button
              variant="default"
              size="lg"
              className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 border-0 text-white"
              asChild
            >
              <Link
                href="https://opencollective.com/wewrite-app"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="relative z-10 flex items-center justify-center">
                  Support Us
                  <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionComingSoonModal;