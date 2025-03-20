"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Youtube, Instagram, Twitter } from "lucide-react";

interface SocialMediaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SocialMediaModal({ open, onOpenChange }: SocialMediaModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share on Social Media</DialogTitle>
          <DialogDescription>
            Share your writing journey with your followers
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => window.open("https://x.com/WeWriteApp", "_blank")}
          >
            <Twitter className="mr-2 h-4 w-4" />
            Follow on X (Twitter)
          </Button>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => window.open("https://youtube.com/@WeWriteApp", "_blank")}
          >
            <Youtube className="mr-2 h-4 w-4" />
            Subscribe on YouTube
          </Button>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => window.open("https://instagram.com/getwewrite", "_blank")}
          >
            <Instagram className="mr-2 h-4 w-4" />
            Follow on Instagram
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 