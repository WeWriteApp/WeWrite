"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import PillLink from '../../components/utils/PillLink';
import { UsernameBadge } from '../../components/ui/UsernameBadge';
import { ComponentShowcase, StateDemo } from './shared';
import { useToast } from '../../components/ui/use-toast';
import { ToastAction } from '../../components/ui/toast';

export function PillLinkSection({ id }: { id: string }) {
  const { toast } = useToast();

  // Handler for disabled external link clicks - demonstrates the toast message
  const handleDisabledExternalLinkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toast({
      title: "External link unavailable",
      description: "This author doesn't have an active subscription. External links are a paid feature.",
      variant: "default",
      action: (
        <ToastAction
          altText="Upgrade to subscription"
          onClick={() => {
            // In real usage this would navigate to /settings/subscription
            toast({
              title: "Demo Mode",
              description: "In production, this would navigate to subscription settings.",
            });
          }}
        >
          Upgrade
        </ToastAction>
      )
    });
  };

  return (
    <ComponentShowcase
      id={id}
      title="PillLink Components Matrix"
      path="app/components/utils/PillLink.tsx + UsernameBadge.tsx"
      description="Complete showcase of all pill link styles and types. Hover and click to test interactions!"
    >
      <div className="wewrite-card p-4 bg-muted/30 overflow-x-auto">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            <strong>Table Structure:</strong> Rows = Styles, Columns = Link Types. All interactions use <code className="bg-muted px-1 rounded">scale-[1.05]</code> on hover and <code className="bg-muted px-1 rounded">scale-[0.95]</code> on active.
          </p>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Style</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Page Link</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">User (no sub)</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">User (tier 3)</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">External Link</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Compound Link</th>
            </tr>
          </thead>
          <tbody>
            {/* Filled Style Row */}
            <tr className="border-b border-border/50">
              <td className="p-3 align-middle">
                <div>
                  <p className="text-sm font-medium">Filled</p>
                  <p className="text-xs text-muted-foreground mt-1">Default style</p>
                </div>
              </td>
              <td className="p-3 align-middle">
                <PillLink href="/example" pageId="ex1" clickable={false}>AI Research</PillLink>
              </td>
              <td className="p-3 align-middle">
                <UsernameBadge
                  userId="user1"
                  username="alex"
                  tier={null}
                  variant="pill"
                  pillVariant="primary"
                />
              </td>
              <td className="p-3 align-middle">
                <UsernameBadge
                  userId="user2"
                  username="sarah"
                  tier="tier3"
                  variant="pill"
                  pillVariant="primary"
                />
              </td>
              <td className="p-3 align-middle">
                <PillLink href="https://example.com" clickable={false}>Documentation</PillLink>
              </td>
              <td className="p-3 align-middle">
                <div className="inline-flex items-center gap-1.5">
                  <PillLink href="/page" pageId="p1" clickable={false}>Startup Guide</PillLink>
                  <span className="text-sm text-muted-foreground">by</span>
                  <UsernameBadge
                    userId="user3"
                    username="jamie"
                    tier="tier3"
                    variant="pill"
                    pillVariant="outline"
                  />
                </div>
              </td>
            </tr>

            {/* Outline Style Row */}
            <tr className="border-b border-border/50">
              <td className="p-3 align-middle">
                <div>
                  <p className="text-sm font-medium">Outline</p>
                  <p className="text-xs text-muted-foreground mt-1">Bordered style</p>
                </div>
              </td>
              <td className="p-3 align-middle">
                <a href="#" className="inline-flex items-center text-sm font-medium rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border border-accent-70 hover:bg-accent-10 hover:border-accent-100 active:bg-accent-15 active:border-accent-100 px-2 py-0.5" onClick={(e) => e.preventDefault()}>
                  AI Research
                </a>
              </td>
              <td className="p-3 align-middle">
                <a href="#" className="inline-flex items-center gap-1 text-sm font-medium rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border border-accent-70 hover:bg-accent-10 hover:border-accent-100 active:bg-accent-15 active:border-accent-100 px-2 py-0.5" onClick={(e) => e.preventDefault()}>
                  <span>alex</span>
                  <span className="inline-flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground dark:text-white"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
                  </span>
                </a>
              </td>
              <td className="p-3 align-middle">
                <a href="#" className="inline-flex items-center gap-1 text-sm font-medium rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border border-accent-70 hover:bg-accent-10 hover:border-accent-100 active:bg-accent-15 active:border-accent-100 px-2 py-0.5" onClick={(e) => e.preventDefault()}>
                  <span>sarah</span>
                  <span className="inline-flex items-center gap-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </span>
                </a>
              </td>
              <td className="p-3 align-middle">
                <a href="#" className="inline-flex items-center text-sm font-medium rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border border-accent-70 hover:bg-accent-10 hover:border-accent-100 active:bg-accent-15 active:border-accent-100 px-2 py-0.5" onClick={(e) => e.preventDefault()}>
                  <span>Documentation</span>
                  <Icon name="ExternalLink" size={14} className="ml-1.5 flex-shrink-0" />
                </a>
              </td>
              <td className="p-3 align-middle">
                <div className="inline-flex items-center gap-1.5">
                  <a href="#" className="inline-flex items-center text-sm font-medium rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border border-accent-70 hover:bg-accent-10 hover:border-accent-100 active:bg-accent-15 active:border-accent-100 px-2 py-0.5" onClick={(e) => e.preventDefault()}>
                    Startup Guide
                  </a>
                  <span className="text-sm text-muted-foreground">by</span>
                  <a href="#" className="inline-flex items-center gap-1 text-sm font-medium rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-muted-foreground border border-muted-foreground/30 hover:bg-muted hover:border-muted-foreground/50 px-2 py-0.5" onClick={(e) => e.preventDefault()}>
                    <span>jamie</span>
                    <span className="inline-flex items-center gap-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </span>
                  </a>
                </div>
              </td>
            </tr>

            {/* Text Only Style Row */}
            <tr className="border-b border-border/50">
              <td className="p-3 align-middle">
                <div>
                  <p className="text-sm font-medium">Text Only</p>
                  <p className="text-xs text-muted-foreground mt-1">Minimal style</p>
                </div>
              </td>
              <td className="p-3 align-middle">
                <a href="#" className="inline-flex items-center text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none hover:underline hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                  AI Research
                </a>
              </td>
              <td className="p-3 align-middle">
                <a href="#" className="inline-flex items-center gap-1 text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none hover:underline hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                  <span>alex</span>
                  <span className="inline-flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground dark:text-white"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
                  </span>
                </a>
              </td>
              <td className="p-3 align-middle">
                <a href="#" className="inline-flex items-center gap-1 text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none hover:underline hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                  <span>sarah</span>
                  <span className="inline-flex items-center gap-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </span>
                </a>
              </td>
              <td className="p-3 align-middle">
                <a href="#" className="inline-flex items-center text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none hover:underline hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                  <span>Documentation</span>
                  <Icon name="ExternalLink" size={14} className="ml-1.5 flex-shrink-0" />
                </a>
              </td>
              <td className="p-3 align-middle">
                <div className="inline-flex items-center gap-1.5">
                  <a href="#" className="inline-flex items-center text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none hover:underline hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                    Startup Guide
                  </a>
                  <span className="text-sm text-muted-foreground">by</span>
                  <a href="#" className="inline-flex items-center gap-1 text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-muted-foreground border-none hover:underline hover:bg-muted/50 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                    <span>jamie</span>
                    <span className="inline-flex items-center gap-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </span>
                  </a>
                </div>
              </td>
            </tr>

            {/* Underlined Style Row */}
            <tr>
              <td className="p-3 align-middle">
                <div>
                  <p className="text-sm font-medium">Underlined</p>
                  <p className="text-xs text-muted-foreground mt-1">Always underlined</p>
                </div>
              </td>
              <td className="p-3 align-middle">
                <a href="#" className="inline-flex items-center text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none underline hover:decoration-2 hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                  AI Research
                </a>
              </td>
              <td className="p-3 align-middle">
                <a href="#" className="inline-flex items-center gap-1 text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none underline hover:decoration-2 hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                  <span>alex</span>
                  <span className="inline-flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground dark:text-white"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
                  </span>
                </a>
              </td>
              <td className="p-3 align-middle">
                <a href="#" className="inline-flex items-center gap-1 text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none underline hover:decoration-2 hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                  <span>sarah</span>
                  <span className="inline-flex items-center gap-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </span>
                </a>
              </td>
              <td className="p-3 align-middle">
                <a href="#" className="inline-flex items-center text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none underline hover:decoration-2 hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                  <span>Documentation</span>
                  <Icon name="ExternalLink" size={14} className="ml-1.5 flex-shrink-0" />
                </a>
              </td>
              <td className="p-3 align-middle">
                <div className="inline-flex items-center gap-1.5">
                  <a href="#" className="inline-flex items-center text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-accent-100 border-none underline hover:decoration-2 hover:bg-accent-5 active:bg-accent-10 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                    Startup Guide
                  </a>
                  <span className="text-sm text-muted-foreground">by</span>
                  <a href="#" className="inline-flex items-center gap-1 text-sm font-bold rounded-lg transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] my-0.5 bg-transparent text-muted-foreground border-none underline hover:decoration-2 hover:bg-muted/50 shadow-none px-1" onClick={(e) => e.preventDefault()}>
                    <span>jamie</span>
                    <span className="inline-flex items-center gap-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="rgb(250 204 21)" stroke="rgb(250 204 21)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </span>
                  </a>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <StateDemo label="Style Configuration">
        <div className="wewrite-card p-4 bg-muted/30">
          <h4 className="font-medium mb-2">Available Styles</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Users can change their preferred pill style in Settings via <code className="bg-muted px-1 rounded">PillStyleContext</code>.
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <code className="bg-muted px-1 rounded">filled</code> - Bold filled background (default)</li>
            <li>• <code className="bg-muted px-1 rounded">outline</code> - Bordered with transparent background</li>
            <li>• <code className="bg-muted px-1 rounded">text_only</code> - Clean text that underlines on hover</li>
            <li>• <code className="bg-muted px-1 rounded">underlined</code> - Always underlined text</li>
          </ul>
        </div>
      </StateDemo>

      <StateDemo label="Special States">
        <div className="flex flex-wrap gap-2">
          <PillLink href="/deleted-page" deleted={true}>Deleted Page</PillLink>
          <PillLink href="/suggestion" isSuggestion={true}>Link Suggestion</PillLink>
          <PillLink href="/example-page" pageId="example123" isLoading={true}>Loading...</PillLink>
        </div>
      </StateDemo>

      <StateDemo label="Disabled External Links (Paywall)">
        <div className="wewrite-card p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground mb-4">
            When a page author doesn't have an active subscription, their external links are rendered as plain text with a dotted underline.
            The link data is preserved in the document, but clicking shows a toast explaining the limitation.
            <strong className="block mt-2">Hover to see the tooltip, click to see the toast message!</strong>
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Enabled (subscriber)</span>
              <PillLink href="https://example.com" clickable={false}>External Docs</PillLink>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Disabled (no subscription)</span>
              <PillLink
                href="https://example.com"
                disabled={true}
                disabledReason="External links are not supported for users without an active subscription"
                onClick={handleDisabledExternalLinkClick}
              >
                External Docs
              </PillLink>
            </div>
          </div>
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Implementation Note:</strong> The <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">disabled</code> prop for external links
              renders the link as plain text with <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">decoration-dotted</code> underline and <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">cursor-not-allowed</code>.
              A native <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">title</code> attribute provides a tooltip on hover, and clicking shows a toast explaining external links require a subscription.
            </p>
          </div>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
