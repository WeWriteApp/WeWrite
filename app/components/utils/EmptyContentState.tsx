"use client";

import React, { useContext } from 'react';
import { Icon } from '@/components/ui/Icon';
import { MobileContext } from '../../providers/MobileProvider';
import { cn, wewriteCard } from '../../lib/utils';

interface EmptyContentStateProps {
  onActivate?: () => void;
  message?: string;
  placeholder?: string;
  ownerMessage?: string;
  visitorMessage?: string;
  isOwner?: boolean;
  className?: string;
}

export default function EmptyContentState({
  onActivate,
  message = "to start editing",
  placeholder = "",
  ownerMessage = "You haven't added any content yet.",
  visitorMessage = "No content has been added yet.",
  isOwner = false,
  className = ""
}: EmptyContentStateProps) {
  const { isMobile } = useContext(MobileContext);
  const actionText = isMobile ? "Tap" : "Click";

  const promptText = isOwner
    ? `${actionText} ${message}`
    : visitorMessage;

  const handleClick = isOwner ? onActivate : undefined;

  return (
    <div
      onClick={handleClick}
      className={cn(
        "relative transition-all duration-200",
        isOwner ? (
          wewriteCard('default', 'empty-state-border hover:border-muted-foreground/50 cursor-pointer bg-muted/20 hover:bg-muted/30 p-2')
        ) : (
          wewriteCard('default')
        ),
        className
      )}
    >
      <div className="flex flex-col items-center justify-center text-center space-y-2 py-4">
        {isOwner && (
          <div className="w-8 h-8 rounded-full bg-muted-foreground/10 flex items-center justify-center mb-1">
            <Icon name="Edit" size={16} className="text-muted-foreground/70" />
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
