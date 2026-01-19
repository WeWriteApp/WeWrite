"use client";

/**
 * Turnstile / Spam Challenge Section
 *
 * Admin testing tool for previewing Turnstile CAPTCHA challenges at different risk levels.
 * Allows admins to see exactly what users experience when facing spam challenges.
 */

import React, { useState } from 'react';
import { ComponentShowcase, StateDemo } from './shared';
import { ChallengeWrapper, type RiskLevel } from '../../components/auth/ChallengeWrapper';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Icon } from '../../components/ui/Icon';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

export function TurnstileSection({ id }: { id: string }) {
  const [selectedLevel, setSelectedLevel] = useState<RiskLevel>('hard_challenge');
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const [demoKey, setDemoKey] = useState(0);

  const handleVerified = (token: string) => {
    setVerificationToken(token);
    setVerificationError(null);
  };

  const handleError = (error: string) => {
    setVerificationError(error);
    setVerificationToken(null);
  };

  const resetDemo = () => {
    setVerificationToken(null);
    setVerificationError(null);
    setDemoKey(prev => prev + 1);
  };

  const riskLevelInfo: Record<RiskLevel, { color: string; description: string; scoreRange: string }> = {
    allow: {
      color: 'bg-green-500',
      description: 'No challenge shown. User is trusted and action proceeds immediately.',
      scoreRange: '0-30',
    },
    soft_challenge: {
      color: 'bg-yellow-500',
      description: 'Invisible challenge runs in background. User doesn\'t see anything unless it fails.',
      scoreRange: '31-60',
    },
    hard_challenge: {
      color: 'bg-orange-500',
      description: 'Visible CAPTCHA widget appears. User must interact to prove they\'re human.',
      scoreRange: '61-85',
    },
    block: {
      color: 'bg-red-500',
      description: 'Action is completely blocked. User sees an error and cannot proceed.',
      scoreRange: '86-100',
    },
  };

  return (
    <ComponentShowcase
      id={id}
      title="Spam Prevention (Turnstile)"
      path="app/components/auth/ChallengeWrapper.tsx"
      description="Cloudflare Turnstile integration for bot detection and spam prevention. Test different challenge levels here."
    >
      {/* Risk Level Selector */}
      <StateDemo label="Select Risk Level to Test">
        <div className="w-full space-y-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="risk-level" className="text-sm font-medium whitespace-nowrap">
              Risk Level:
            </Label>
            <Select
              value={selectedLevel}
              onValueChange={(value) => {
                setSelectedLevel(value as RiskLevel);
                resetDemo();
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allow">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Allow (0-30)
                  </div>
                </SelectItem>
                <SelectItem value="soft_challenge">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    Soft Challenge (31-60)
                  </div>
                </SelectItem>
                <SelectItem value="hard_challenge">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    Hard Challenge (61-85)
                  </div>
                </SelectItem>
                <SelectItem value="block">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    Block (86-100)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Level Description */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-3 h-3 rounded-full ${riskLevelInfo[selectedLevel].color}`} />
              <span className="font-medium capitalize">{selectedLevel.replace('_', ' ')}</span>
              <Badge variant="outline" className="text-xs">
                Score: {riskLevelInfo[selectedLevel].scoreRange}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {riskLevelInfo[selectedLevel].description}
            </p>
          </div>
        </div>
      </StateDemo>

      {/* Live Demo */}
      <StateDemo label="Live Demo">
        <div className="w-full space-y-4">
          {!showDemo ? (
            <Button onClick={() => setShowDemo(true)} className="w-full">
              <Icon name="Play" size={16} className="mr-2" />
              Start Challenge Demo
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-border bg-card">
                <p className="text-sm text-muted-foreground mb-4">
                  This simulates what a user would see when performing a sensitive action
                  (like creating a page or registering) with a risk score of {riskLevelInfo[selectedLevel].scoreRange}:
                </p>

                <ChallengeWrapper
                  key={demoKey}
                  riskLevel={selectedLevel}
                  onVerified={handleVerified}
                  onError={handleError}
                  action="admin_demo"
                  showLoading={true}
                >
                  <div className="p-4 rounded-lg bg-muted/30 border border-dashed border-border">
                    <p className="text-sm text-center text-muted-foreground">
                      [Your form content would appear here]
                    </p>
                  </div>
                </ChallengeWrapper>

                {/* Status indicator */}
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    {verificationToken ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <Icon name="CheckCircle" size={14} />
                        Verified
                      </span>
                    ) : verificationError ? (
                      <span className="flex items-center gap-1 text-destructive">
                        <Icon name="XCircle" size={14} />
                        {verificationError}
                      </span>
                    ) : selectedLevel === 'block' ? (
                      <span className="flex items-center gap-1 text-destructive">
                        <Icon name="ShieldX" size={14} />
                        Blocked
                      </span>
                    ) : selectedLevel === 'allow' ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <Icon name="ShieldCheck" size={14} />
                        Auto-allowed (no challenge)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Icon name="Clock" size={14} />
                        Pending verification...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={resetDemo} className="flex-1">
                  <Icon name="RotateCcw" size={14} className="mr-2" />
                  Reset Demo
                </Button>
                <Button variant="outline" onClick={() => setShowDemo(false)} className="flex-1">
                  <Icon name="X" size={14} className="mr-2" />
                  Close Demo
                </Button>
              </div>
            </div>
          )}
        </div>
      </StateDemo>

      {/* Implementation Notes */}
      <StateDemo label="Implementation Notes">
        <div className="w-full space-y-3 text-sm">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-2">
              <Icon name="AlertTriangle" size={16} className="text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-600">Not Yet Deployed</p>
                <p className="text-muted-foreground text-xs mt-1">
                  The ChallengeWrapper component is built but not yet integrated into sensitive actions
                  like registration, page creation, or link addition.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
            <p className="font-medium">Where to deploy:</p>
            <ul className="list-disc list-inside text-muted-foreground text-xs space-y-1">
              <li>Registration form (highest priority)</li>
              <li>Page creation for users with risk &gt; 30</li>
              <li>Adding external links for users with risk &gt; 30</li>
              <li>Password reset requests</li>
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
            <p className="font-medium">How it works:</p>
            <ul className="list-disc list-inside text-muted-foreground text-xs space-y-1">
              <li><strong>allow</strong>: User passes through with no delay</li>
              <li><strong>soft_challenge</strong>: Invisible check, fails silently if suspicious</li>
              <li><strong>hard_challenge</strong>: Shows visible widget like this demo</li>
              <li><strong>block</strong>: Prevents action entirely with error message</li>
            </ul>
          </div>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
