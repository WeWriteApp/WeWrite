"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Youtube, Instagram, Twitter } from "lucide-react";

interface SocialMediaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SocialMediaModal({ open, onOpenChange }: SocialMediaModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Coming Soon!</DialogTitle>
          <DialogDescription>
            Donation functionality doesn't exist yet! Please follow us on social media for updates!
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => window.open("https://www.youtube.com/@WeWriteApp", "_blank")}
          >
            <Youtube className="h-4 w-4" />
            YouTube
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => window.open("https://www.instagram.com/getwewrite/", "_blank")}
          >
            <Instagram className="h-4 w-4" />
            Instagram
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => window.open("https://x.com/WeWriteApp", "_blank")}
          >
            <Twitter className="h-4 w-4" />
            X (Twitter)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 