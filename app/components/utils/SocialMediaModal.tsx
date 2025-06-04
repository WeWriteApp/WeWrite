"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Youtube, Instagram, Twitter } from "lucide-react";

interface SocialMediaModalProps {
  open: boolean;
  onClose: () => void;
}

// This is a placeholder component to fix build errors
// The functionality is now in PledgeBarModal.js
export default function SocialMediaModal({ open, onClose }: SocialMediaModalProps) {
  return null;
} 