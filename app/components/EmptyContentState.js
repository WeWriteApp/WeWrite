"use client";

import React, { useContext } from 'react';
import { MobileContext } from '../providers/MobileProvider';
import { cn } from '../lib/utils';
import { Edit } from 'lucide-react';

/**
 * EmptyContentState - A reusable component for empty content states
 * 
 * Features:
 * - Context-aware text based on device type (Click/Tap)
 * - Clickable/tappable area to trigger edit mode
 * - Visual cues to indicate editability (dashed border, placeholder text)
 * - Customizable appearance
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onActivate - Function to call when the empty state is clicked/tapped
 * @param {string} props.message - Custom message to display (will be prefixed with "Click" or "Tap")
 * @param {string} props.placeholder - Placeholder text to show
 * @param {string} props.ownerMessage - Message to show when user is the owner
 * @param {string} props.visitorMessage - Message to show when user is not the owner
 * @param {boolean} props.isOwner - Whether the current user is the owner
 * @param {string} props.className - Additional CSS classes
 */
export default function EmptyContentState({
  onActivate,
  message = "to start editing",
  placeholder = "",
  ownerMessage = "You haven't added any content yet.",
  visitorMessage = "No content has been added yet.",
  isOwner = false,
  className = ""
}) {
  const { isMobile } = useContext(MobileContext);
  const actionText = isMobile ? "Tap" : "Click";
  
  // Only show the action prompt if the user is the owner
  const promptText = isOwner 
    ? `${actionText} ${message}`
    : visitorMessage;
  
  // If user is not the owner, don't make it clickable
  const handleClick = isOwner ? onActivate : undefined;
  
  return (
    <div
      onClick={handleClick}
      className={cn(
        "relative p-6 rounded-lg transition-all duration-200",
        isOwner ? (
          "border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 cursor-pointer bg-muted/20 hover:bg-muted/30"
        ) : (
          "border border-border bg-card"
        ),
        className
      )}
    >
      <div className="flex flex-col items-center justify-center text-center space-y-3 py-8">
        {isOwner && (
          <div className="w-10 h-10 rounded-full bg-muted-foreground/10 flex items-center justify-center">
            <Edit className="h-5 w-5 text-muted-foreground/70" />
          </div>
        )}
        
        <div className="space-y-2">
          <p className="text-muted-foreground font-medium">
            {isOwner ? ownerMessage : visitorMessage}
          </p>
          
          {isOwner && (
            <p className="text-sm text-muted-foreground/70">
              {promptText}
            </p>
          )}
        </div>
        
        {placeholder && (
          <div className="text-sm text-muted-foreground/50 italic mt-4">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}
