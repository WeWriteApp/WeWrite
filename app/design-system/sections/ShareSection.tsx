"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../components/ui/button';
import { ComponentShowcase, StateDemo } from './shared';
import { handleGenericShare, handleProfileShare } from '../../utils/pageActionHandlers';
import { useAuth } from '../../providers/AuthProvider';

export function ShareSection({ id }: { id: string }) {
  const { user } = useAuth();
  const [lastAction, setLastAction] = useState<string>('');

  const handleDemoShare = (type: string, title: string) => {
    setLastAction(`Triggered: ${type}`);

    if (type === 'page') {
      // Demo page share
      handleGenericShare({
        title: 'Example Page Title by author on WeWrite',
        text: 'Check out this page on WeWrite',
        analyticsContext: 'design_system_demo',
        user
      });
    } else if (type === 'profile-bio') {
      handleProfileShare('demouser', 'bio', user);
    } else if (type === 'profile-graph') {
      handleProfileShare('demouser', 'graph', user);
    } else if (type === 'profile-pages') {
      handleProfileShare('demouser', 'pages', user);
    } else if (type === 'custom') {
      handleGenericShare({
        url: 'https://getwewrite.app/map?lat=35&lng=-106',
        title: 'New Mexico on WeWrite Map',
        text: 'Check out this location',
        analyticsContext: 'design_system_demo',
        user
      });
    }
  };

  return (
    <ComponentShowcase
      id={id}
      title="Share System"
      path="app/utils/pageActionHandlers.ts"
      description="Centralized share functionality using Web Share API with clipboard fallback. All share actions should use these handlers to ensure consistent behavior, proper titles, and analytics tracking. See docs/ui/SHARE_SYSTEM.md for full documentation."
    >
      <StateDemo label="Share Handlers">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDemoShare('page', 'Page Share')}
          >
            <Icon name="Share" size={14} className="mr-2" />
            handleShare (Page)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDemoShare('profile-bio', 'Profile Bio')}
          >
            <Icon name="User" size={14} className="mr-2" />
            handleProfileShare (Bio)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDemoShare('profile-graph', 'Profile Graph')}
          >
            <Icon name="Network" size={14} className="mr-2" />
            handleProfileShare (Graph)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDemoShare('custom', 'Custom URL')}
          >
            <Icon name="MapPin" size={14} className="mr-2" />
            handleGenericShare (Custom)
          </Button>
        </div>
        {lastAction && (
          <p className="text-sm text-muted-foreground mt-2">{lastAction}</p>
        )}
      </StateDemo>

      <StateDemo label="Title Formats">
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <code className="bg-muted px-2 py-1 rounded text-xs">Page:</code>
            <span className="text-muted-foreground">"Page Title by author on WeWrite"</span>
          </div>
          <div className="flex items-start gap-2">
            <code className="bg-muted px-2 py-1 rounded text-xs">Profile (Bio):</code>
            <span className="text-muted-foreground">"username - Bio on WeWrite"</span>
          </div>
          <div className="flex items-start gap-2">
            <code className="bg-muted px-2 py-1 rounded text-xs">Profile (Pages):</code>
            <span className="text-muted-foreground">"username - Pages on WeWrite"</span>
          </div>
          <div className="flex items-start gap-2">
            <code className="bg-muted px-2 py-1 rounded text-xs">Profile (Graph):</code>
            <span className="text-muted-foreground">"username - Graph on WeWrite"</span>
          </div>
          <div className="flex items-start gap-2">
            <code className="bg-muted px-2 py-1 rounded text-xs">Custom:</code>
            <span className="text-muted-foreground">Your custom title</span>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Available Tab Names">
        <div className="flex flex-wrap gap-2">
          {['bio', 'pages', 'recent-activity', 'timeline', 'graph', 'map', 'external-links'].map(tab => (
            <code key={tab} className="bg-muted px-2 py-1 rounded text-xs">{tab}</code>
          ))}
        </div>
      </StateDemo>

      <StateDemo label="Implementation">
        <div className="bg-muted/50 rounded-lg p-4 font-mono text-xs overflow-x-auto">
          <pre>{`// Page sharing
import { handleShare } from '@/utils/pageActionHandlers';
handleShare(page, page.title, user);

// Profile sharing (tab-aware)
import { handleProfileShare } from '@/utils/pageActionHandlers';
handleProfileShare(username, currentTab, user);

// Custom URL sharing
import { handleGenericShare } from '@/utils/pageActionHandlers';
handleGenericShare({
  url: 'https://...',
  title: 'Title on WeWrite',
  text: 'Description',
  analyticsContext: 'my_feature',
  user
});`}</pre>
        </div>
      </StateDemo>

      <StateDemo label="Share Flow">
        <div className="text-sm text-muted-foreground space-y-1">
          <p>1. Check if <code className="bg-muted px-1 rounded">navigator.share</code> is available</p>
          <p className="pl-4">- If yes: Use native Web Share API (mobile share sheets)</p>
          <p className="pl-4">- If no: Copy URL to clipboard</p>
          <p>2. Track analytics event (succeeded/aborted)</p>
          <p>3. Show toast feedback on clipboard copy</p>
        </div>
      </StateDemo>

      <StateDemo label="Analytics Events">
        <div className="flex flex-wrap gap-2">
          <code className="bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded text-xs">page_share_succeeded</code>
          <code className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded text-xs">page_share_aborted</code>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Tracked with: share_method, share_context, user_id, share_title
        </p>
      </StateDemo>
    </ComponentShowcase>
  );
}
