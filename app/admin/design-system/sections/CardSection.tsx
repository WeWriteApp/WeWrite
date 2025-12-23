"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { ComponentShowcase, StateDemo } from './shared';

export function CardSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Card"
      path="app/components/ui/card.tsx"
      description="Glassmorphic container with header, content, and footer sections"
    >
      <StateDemo label="Basic Card">
        <Card className="w-80">
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>This is a card description that explains the content.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">This is the main content area of the card where you can place any content.</p>
          </CardContent>
        </Card>
      </StateDemo>

      <StateDemo label="Interactive Card">
        <Card className="w-80 hover:bg-muted/50 transition-colors cursor-pointer">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Icon name="Heart" size={20} className="text-red-500" />
                Interactive Card
              </CardTitle>
              <Badge>New</Badge>
            </div>
            <CardDescription>This card has hover effects and interactive elements.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm">Click anywhere on this card</span>
              <Button size="sm">Action</Button>
            </div>
          </CardContent>
        </Card>
      </StateDemo>
    </ComponentShowcase>
  );
}
