"use client";

import React, { useContext } from 'react';
import { MobileContext } from '../../providers/MobileProvider';
import { cn, wewriteCard } from '../../lib/utils';
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
        "relative transition-all duration-200",
        isOwner ? (
          wewriteCard('default', 'border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 cursor-pointer bg-muted/20 hover:bg-muted/30 p-2')
        ) : (
          wewriteCard('default')
        ),
        className
      )}
    >
      <div className="flex flex-col items-center justify-center text-center space-y-2 py-4">
        {isOwner && (
          <div className="w-8 h-8 rounded-full bg-muted-foreground/10 flex items-center justify-center mb-1">
            <Edit className="h-4 w-4 text-muted-foreground/70" />
          </div>
        )}

        <div className="space-y-1">
          <p className="text-muted-foreground font-medium text-sm">
            {isOwner ? ownerMessage : visitorMessage}
          </p>

          {isOwner && (
            <p className="text-xs text-muted-foreground/70">
              {promptText}
            </p>
          )}
        </div>

        {placeholder && (
          <div className="text-xs text-muted-foreground/50 italic mt-2">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}