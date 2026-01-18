/**
 * Risk Assessment Section Component
 *
 * Displays detailed risk assessment information for a user in the admin drawer.
 * Shows overall risk score, factor breakdown, and recent risk history.
 *
 * @see app/services/RiskScoringService.ts
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { RiskScoreBadge, type RiskLevel } from './RiskScoreBadge';
import { adminFetch } from '../../utils/adminFetch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface RiskFactor {
  name: string;
  score: number;
  description: string;
  icon: string;
}

interface RiskHistoryEntry {
  timestamp: string;
  action: string;
  score: number;
  level: RiskLevel;
  reasons: string[];
}

interface RiskAssessmentData {
  score: number;
  level: RiskLevel;
  factors: {
    botDetection: { score: number; confidence?: number; reasons?: string[] };
    ipReputation: { score: number; isProxy?: boolean; isVpn?: boolean; isTor?: boolean };
    accountTrust: { score: number; trustLevel?: string; accountAge?: number; emailVerified?: boolean };
    behavioral: { score: number; suspiciousPatterns?: string[] };
    velocity: { score: number; recentActions?: number; exceededLimit?: boolean };
  };
  lastAssessment?: string;
  history?: RiskHistoryEntry[];
}

interface RiskAssessmentSectionProps {
  userId: string;
  // Optional pre-calculated score from the users table
  preCalculatedScore?: number;
}

// Calculate a client-side risk score based on user data
function calculateClientRiskScore(userData: {
  createdAt?: any;
  emailVerified?: boolean;
  totalPages?: number;
  financial?: { hasSubscription?: boolean };
  isAdmin?: boolean;
  lastLogin?: any;
}): number {
  let score = 50; // Start at medium risk

  // Account age reduces risk
  if (userData.createdAt) {
    const createdDate = userData.createdAt?.toDate?.() || new Date(userData.createdAt);
    const ageInDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    if (ageInDays > 90) score -= 30;
    else if (ageInDays > 30) score -= 20;
    else if (ageInDays > 7) score -= 10;
    else score += 10;
  } else {
    score += 10;
  }

  // Email verification reduces risk
  if (userData.emailVerified) {
    score -= 15;
  } else {
    score += 5;
  }

  // Content creation shows engagement
  if (userData.totalPages !== undefined) {
    if (userData.totalPages > 50) score -= 15;
    else if (userData.totalPages > 10) score -= 10;
    else if (userData.totalPages > 0) score -= 5;
    else score += 5;
  }

  // Subscription shows commitment
  if (userData.financial?.hasSubscription) {
    score -= 10;
  }

  // Admin users are trusted
  if (userData.isAdmin) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

function scoreToLevel(score: number): RiskLevel {
  if (score <= 30) return 'allow';
  if (score <= 60) return 'soft_challenge';
  if (score <= 85) return 'hard_challenge';
  return 'block';
}

const FACTOR_INFO: Record<string, { icon: string; label: string; description: string }> = {
  botDetection: {
    icon: 'Bot',
    label: 'Bot Detection',
    description: 'Analyzes browser fingerprint, user agent, and automation indicators',
  },
  ipReputation: {
    icon: 'Globe',
    label: 'IP Reputation',
    description: 'Checks IP against known bad actor lists and proxy/VPN detection',
  },
  accountTrust: {
    icon: 'UserCheck',
    label: 'Account Trust',
    description: 'Based on account age, email verification, and activity history',
  },
  behavioral: {
    icon: 'Activity',
    label: 'Behavioral',
    description: 'Session patterns, interaction rates, and content velocity',
  },
  velocity: {
    icon: 'Zap',
    label: 'Velocity',
    description: 'Rate of actions and whether limits have been exceeded',
  },
};

export function RiskAssessmentSection({ userId, preCalculatedScore }: RiskAssessmentSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RiskAssessmentData | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Use pre-calculated score if available
  const displayScore = data?.score ?? preCalculatedScore ?? null;
  const displayLevel = data?.level ?? (displayScore !== null ? scoreToLevel(displayScore) : null);

  useEffect(() => {
    if (!userId) return;

    const loadRiskData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await adminFetch(`/api/risk-assessment?userId=${userId}&history=true`);
        if (!response.ok) {
          if (response.status === 404) {
            // No risk data yet - that's okay, we'll use calculated score
            setData(null);
          } else {
            throw new Error('Failed to load risk data');
          }
        } else {
          const result = await response.json();
          if (result.success && result.data) {
            setData(result.data);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load risk data');
      } finally {
        setLoading(false);
      }
    };

    loadRiskData();
  }, [userId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon name="Shield" size={14} />
          Risk Assessment
        </div>
        <div className="flex items-center justify-center py-4">
          <Icon name="Loader" className="text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      {/* Header with score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon name="Shield" size={14} />
          Risk Assessment
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger>
                <Icon name="HelpCircle" size={12} className="text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">
                  Risk Score measures the likelihood of spam/bot activity based on bot detection,
                  IP reputation, account behavior, and activity patterns. Lower is better.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {displayScore !== null && displayLevel && (
          <RiskScoreBadge score={displayScore} level={displayLevel} showTooltip={true} />
        )}
      </div>

      {/* Score gauge */}
      {displayScore !== null && (
        <div className="space-y-1">
          <Progress
            value={displayScore}
            className="h-2"
            indicatorClassName={
              displayScore <= 30
                ? 'bg-green-500'
                : displayScore <= 60
                ? 'bg-yellow-500'
                : displayScore <= 85
                ? 'bg-orange-500'
                : 'bg-red-500'
            }
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Low Risk</span>
            <span>High Risk</span>
          </div>
        </div>
      )}

      {/* Factor breakdown */}
      {data?.factors && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="text-xs font-medium text-muted-foreground">Risk Factors</div>
          <div className="space-y-1.5">
            {Object.entries(data.factors).map(([key, value]) => {
              const info = FACTOR_INFO[key];
              if (!info || typeof value !== 'object') return null;

              const factorScore = (value as any).score ?? 0;

              return (
                <TooltipProvider key={key}>
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <Icon name={info.icon} size={12} className="text-muted-foreground" />
                          <span>{info.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                factorScore <= 30
                                  ? 'bg-green-500'
                                  : factorScore <= 60
                                  ? 'bg-yellow-500'
                                  : factorScore <= 85
                                  ? 'bg-orange-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${factorScore}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground w-6 text-right">{factorScore}</span>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <p className="text-xs">{info.description}</p>
                      {key === 'accountTrust' && (value as any).trustLevel && (
                        <p className="text-xs mt-1">Trust level: {(value as any).trustLevel}</p>
                      )}
                      {key === 'velocity' && (value as any).exceededLimit && (
                        <p className="text-xs mt-1 text-destructive">Rate limit exceeded</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
      )}

      {/* Risk history */}
      {data?.history && data.history.length > 0 && (
        <div className="pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs justify-between"
            onClick={() => setShowHistory(!showHistory)}
          >
            <span>Recent Activity ({data.history.length})</span>
            <Icon name={showHistory ? 'ChevronUp' : 'ChevronDown'} size={12} />
          </Button>

          {showHistory && (
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
              {data.history.slice(0, 5).map((entry, index) => (
                <div key={index} className="flex items-start gap-2 text-xs p-2 bg-muted/50 rounded">
                  <RiskScoreBadge score={entry.score} size="sm" showTooltip={false} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium capitalize">{entry.action.replace(/_/g, ' ')}</div>
                    <div className="text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                    {entry.reasons.length > 0 && (
                      <div className="text-muted-foreground truncate">
                        {entry.reasons.slice(0, 2).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No data fallback */}
      {!data && displayScore === null && (
        <div className="text-xs text-muted-foreground py-2 text-center">
          No risk assessment data available
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-xs text-destructive py-2 text-center">
          {error}
        </div>
      )}

      {/* Explanation */}
      <div className="pt-2 border-t border-border">
        <div className="text-[10px] text-muted-foreground">
          This score determines whether the user faces challenges (CAPTCHA) when performing
          sensitive actions like creating content or accounts.
        </div>
      </div>
    </div>
  );
}

export default RiskAssessmentSection;
