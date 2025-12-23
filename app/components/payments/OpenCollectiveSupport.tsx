"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Icon } from '@/components/ui/Icon';
import { openExternalLink } from '../../utils/pwa-detection';

interface OpenCollectiveSupportProps {
  className?: string;
  variant?: 'card' | 'modal';
  title?: string;
  description?: string;
}

/**
 * OpenCollectiveSupport Component
 *
 * Displays a message about supporting WeWrite through OpenCollective
 * Used as a replacement for subscription components when the feature flag is off
 */
export default function OpenCollectiveSupport({
  className = '',
  variant = 'card',
  title = 'Subscription functionality coming soon!',
  description = 'Please support continued development on WeWrite'
}: OpenCollectiveSupportProps) {
  const handleOpenCollective = () => {
    openExternalLink('https://opencollective.com/wewrite-app', 'OpenCollective Support');
  };

  if (variant === 'modal') {
    return (
      <div className={`flex flex-col items-center space-y-4 p-6 ${className}`}>
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
          <Icon name="Heart" size={24} className="text-primary" />
        </div>

        <h2 className="text-xl font-semibold text-center">{title}</h2>
        <p className="text-center text-muted-foreground">{description}</p>

        <Button
          onClick={handleOpenCollective}
          className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-primary hover:from-teal-600 hover:to-primary/90 animate-gradient-x"
        >
          Support WeWrite
          <Icon name="ArrowRight" size={16} />
        </Button>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="Heart" size={20} className="text-primary" />
          {title}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          WeWrite is a community-supported platform. Your contributions help us continue to build and improve the platform for everyone.
        </p>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleOpenCollective}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-primary hover:from-teal-600 hover:to-primary/90 animate-gradient-x"
        >
          Support WeWrite
          <Icon name="ArrowRight" size={16} />
        </Button>
      </CardFooter>
    </Card>
  );
}