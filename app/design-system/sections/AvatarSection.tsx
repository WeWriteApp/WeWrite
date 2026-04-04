"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { ComponentShowcase, StateDemo } from './shared';

export function AvatarSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Avatar"
      path="app/components/ui/avatar.tsx"
      description="User avatar component built on Radix UI. Supports image with automatic fallback to initials or icon when the image fails to load."
    >
      <StateDemo label="With Image">
        <Avatar>
          <AvatarImage src="https://api.dicebear.com/7.x/initials/svg?seed=JG" alt="JG" />
          <AvatarFallback>JG</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarImage src="https://api.dicebear.com/7.x/initials/svg?seed=WW" alt="WW" />
          <AvatarFallback>WW</AvatarFallback>
        </Avatar>
      </StateDemo>

      <StateDemo label="Fallback (No Image)">
        <Avatar>
          <AvatarFallback>JG</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>WW</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>
            <Icon name="User" size={20} />
          </AvatarFallback>
        </Avatar>
      </StateDemo>

      <StateDemo label="Sizes (via className)">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-xs">S</AvatarFallback>
        </Avatar>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">M</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>D</AvatarFallback>
        </Avatar>
        <Avatar className="h-14 w-14">
          <AvatarFallback className="text-lg">L</AvatarFallback>
        </Avatar>
        <Avatar className="h-20 w-20">
          <AvatarFallback className="text-xl">XL</AvatarFallback>
        </Avatar>
      </StateDemo>

      <StateDemo label="With Status Indicator">
        <div className="relative inline-block">
          <Avatar>
            <AvatarFallback>JG</AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
        </div>
        <div className="relative inline-block">
          <Avatar>
            <AvatarFallback>WW</AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-muted-foreground rounded-full border-2 border-background" />
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
