"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "./ui/dialog";
import { Button } from "./ui/button";
import { X, Heart, ArrowRight } from "lucide-react";
import { openExternalLink } from "../utils/pwa-detection";
import Link from "next/link";

const SupportUsModal = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col rounded-lg border border-border dark:border-neutral-700 bg-white dark:bg-neutral-900 animate-in fade-in-0 zoom-in-95 duration-300">
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
          <DialogTitle className="text-xl text-center w-full">Under Construction</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <p className="text-center text-muted-foreground mb-8">
            We are still working on payments functionality. Please support WeWrite on Open Collective to help get it built. Read about other upcoming features{" "}
            <Link href="/zRNwhNgIEfLFo050nyAT" className="text-primary hover:underline">
              here
            </Link>.
          </p>

          <div className="px-6 mx-auto w-full">
            <Button
              variant="default"
              size="lg"
              className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 border-0 text-white"
              onClick={() => openExternalLink('https://opencollective.com/wewrite-app', 'Support Us Modal')}
            >
              <span className="relative z-10 flex items-center justify-center">
                Support Us
                <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
              </span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupportUsModal;
