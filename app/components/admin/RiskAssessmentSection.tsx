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
import {
  RISK_FACTOR_IMPORTANCE,
  RISK_FACTOR_INFO,
  RISK_THRESHOLDS,
  RISK_LEVELS,
  getRiskLevelFromScore
} from '../../constants/risk-scoring';

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
    accountTrust: { score: number; riskScore?: number; trustLevel?: string; accountAge?: number; emailVerified?: boolean };
    behavioral: { score: number; suspiciousPatterns?: string[] };
    velocity: { score: number; recentActions?: number; exceededLimit?: boolean };
    contentBehavior?: { score: number; pageCount?: number; hasExternalLinks?: boolean; externalLinkCount?: number; hasInternalLinks?: boolean; internalLinkCount?: number; suspiciousPatterns?: string[] };
    financialTrust?: { score: number; hasActiveSubscription?: boolean; subscriptionAmountCents?: number; hasAllocatedToOthers?: boolean; totalAllocatedCents?: number; hasEarnings?: boolean; totalEarningsCents?: number; hasPayoutSetup?: boolean; trustIndicators?: string[]; riskIndicators?: string[] };
  };
  lastAssessment?: string;
  history?: RiskHistoryEntry[];
}

interface RiskAssessmentSectionProps {
  userId: string;
  // Optional pre-calculated score from the users table
  preCalculatedScore?: number;
}

// Calculate a client-side trust score based on user data
// Higher = more trusted
function calculateClientRiskScore(userData: {
  createdAt?: any;
  emailVerified?: boolean;
  totalPages?: number;
  financial?: { hasSubscription?: boolean };
  isAdmin?: boolean;
  lastLogin?: any;
}): number {
  let trustScore = 50; // Start at medium trust

  // Account age increases trust
  if (userData.createdAt) {
    const createdDate = userData.createdAt?.toDate?.() || new Date(userData.createdAt);
    const ageInDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    if (ageInDays > 90) trustScore += 30;
    else if (ageInDays > 30) trustScore += 20;
    else if (ageInDays > 7) trustScore += 10;
    else trustScore -= 10;
  } else {
    trustScore -= 10;
  }

  // Email verification increases trust
  if (userData.emailVerified) {
    trustScore += 15;
  } else {
    trustScore -= 5;
  }

  // Content creation shows engagement
  if (userData.totalPages !== undefined) {
    if (userData.totalPages > 50) trustScore += 15;
    else if (userData.totalPages > 10) trustScore += 10;
    else if (userData.totalPages > 0) trustScore += 5;
    else trustScore -= 5;
  }

  // Subscription shows commitment
  if (userData.financial?.hasSubscription) {
    trustScore += 10;
  }

  // Admin users are trusted
  if (userData.isAdmin) {
    trustScore += 20;
  }

  return Math.max(0, Math.min(100, trustScore));
}

function scoreToLevel(score: number): RiskLevel {
  return getRiskLevelFromScore(score) as RiskLevel;
}

// Use shared RISK_FACTOR_INFO from constants
// NOTE: All scores displayed are TRUST scores (0-100, higher = more trusted)

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
                  Trust Score measures account legitimacy based on bot detection,
                  IP reputation, account behavior, and activity patterns. Higher is better.
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
              displayScore >= 75
                ? 'bg-green-500'
                : displayScore >= 50
                ? 'bg-yellow-500'
                : displayScore >= 25
                ? 'bg-orange-500'
                : 'bg-red-500'
            }
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Suspicious</span>
            <span>Trusted</span>
          </div>
        </div>
      )}

      {/* Factor breakdown */}
      {data?.factors && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="text-xs font-medium text-muted-foreground">Trust Factors</div>
          <p className="text-[10px] text-muted-foreground -mt-1">Higher is better. Score = weighted average of all factors.</p>
          <div className="space-y-1.5">
            {Object.entries(data.factors).map(([key, value]) => {
              const info = RISK_FACTOR_INFO[key as keyof typeof RISK_FACTOR_INFO];
              if (!info || typeof value !== 'object') return null;

              // All factors now use trust scores (higher = more trusted)
              const factorScore = (value as any).score ?? 0;

              return (
                <TooltipProvider key={key}>
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <Icon name={info.icon} size={12} className="text-muted-foreground" />
                          <span>{info.label}</span>
                          {RISK_FACTOR_IMPORTANCE[key] > 1 && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal text-muted-foreground">
                              {RISK_FACTOR_IMPORTANCE[key]}x
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                factorScore >= 75
                                  ? 'bg-green-500'
                                  : factorScore >= 50
                                  ? 'bg-yellow-500'
                                  : factorScore >= 25
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
                      <p className="text-xs font-medium">{info.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{info.riskExplanation}</p>
                      {key === 'accountTrust' && (value as any).trustLevel && (
                        <p className="text-xs mt-1">Trust level: <span className="font-medium">{(value as any).trustLevel}</span></p>
                      )}
                      {key === 'accountTrust' && (value as any).emailVerified !== undefined && (
                        <p className="text-xs">Email: <span className={`font-medium ${(value as any).emailVerified ? 'text-green-600' : 'text-yellow-600'}`}>{(value as any).emailVerified ? 'Verified' : 'Not verified'}</span></p>
                      )}
                      {key === 'velocity' && (value as any).exceededLimit && (
                        <p className="text-xs mt-1 text-destructive font-medium">Rate limit exceeded</p>
                      )}
                      {key === 'contentBehavior' && (
                        <>
                          {(value as any).pageCount !== undefined && (
                            <p className="text-xs mt-1">Pages: <span className="font-medium">{(value as any).pageCount}</span></p>
                          )}
                          {(value as any).externalLinkCount !== undefined && (value as any).externalLinkCount > 0 && (
                            <p className="text-xs text-yellow-600">External links: {(value as any).externalLinkCount}</p>
                          )}
                          {(value as any).internalLinkCount !== undefined && (value as any).internalLinkCount > 0 && (
                            <p className="text-xs text-green-600">Internal links: {(value as any).internalLinkCount}</p>
                          )}
                        </>
                      )}
                      {key === 'financialTrust' && (
                        <>
                          {(value as any).hasActiveSubscription && (
                            <p className="text-xs mt-1 text-green-600 font-medium">
                              Active subscriber (${((value as any).subscriptionAmountCents / 100).toFixed(2)}/mo)
                            </p>
                          )}
                          {(value as any).hasAllocatedToOthers && (
                            <p className="text-xs text-green-600">
                              Supports writers: ${((value as any).totalAllocatedCents / 100).toFixed(2)} allocated
                            </p>
                          )}
                          {(value as any).hasEarnings && (
                            <p className="text-xs text-green-600">
                              Has earnings: ${((value as any).totalEarningsCents / 100).toFixed(2)}
                            </p>
                          )}
                          {(value as any).hasPayoutSetup && (
                            <p className="text-xs text-green-600">Payout account setup</p>
                          )}
                          {!(value as any).hasActiveSubscription && !(value as any).hasAllocatedToOthers && !(value as any).hasEarnings && (
                            <p className="text-xs text-yellow-600 mt-1">No financial activity</p>
                          )}
                        </>
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

      {/* Comprehensive Explanation */}
      <div className="pt-2 border-t border-border space-y-2">
        <details className="group">
          <summary className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-1 hover:text-foreground">
            <Icon name="Info" size={10} />
            <span>How trust scoring works</span>
            <Icon name="ChevronRight" size={10} className="group-open:rotate-90 transition-transform" />
          </summary>
          <div className="mt-2 text-[10px] text-muted-foreground space-y-2 pl-3 border-l border-border">
            <p className="font-medium text-foreground">Trust Score = Weighted average of all factors (0-100, higher = more trusted)</p>
            <p>Factors marked with <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal">3x</Badge> count triple in the calculation (financial trust is weighted 3x because bots don&apos;t pay).</p>

            <div className="space-y-1">
              <p className="font-medium">Trust Levels:</p>
              <ul className="space-y-0.5 ml-2">
                <li><span className="text-green-600 font-medium">75-100 (Trusted)</span>: Legitimate user, no challenges</li>
                <li><span className="text-yellow-600 font-medium">50-74 (Medium)</span>: Invisible CAPTCHA check</li>
                <li><span className="text-orange-600 font-medium">25-49 (Suspicious)</span>: Visible CAPTCHA required</li>
                <li><span className="text-red-600 font-medium">0-24 (Very Suspicious)</span>: Action blocked entirely</li>
              </ul>
            </div>

            <div className="space-y-1">
              <p className="font-medium">7 Trust Factors Analyzed:</p>
              <ol className="space-y-0.5 ml-2 list-decimal list-inside">
                <li><strong>Bot Detection</strong>: Browser fingerprint, automation signals</li>
                <li><strong>IP Reputation</strong>: Proxy/VPN/TOR detection, known bad IPs</li>
                <li><strong>Account Trust</strong>: Account age, email verification status</li>
                <li><strong>Behavioral</strong>: Session patterns, interaction rates</li>
                <li><strong>Velocity</strong>: Rate of actions relative to trust level</li>
                <li><strong>Content Behavior</strong>: Page count, external vs internal links</li>
                <li><strong>Financial Trust</strong>: Subscriptions, allocations to writers</li>
              </ol>
            </div>

            <div className="space-y-1">
              <p className="font-medium">Trust Signals (Higher Score):</p>
              <ul className="space-y-0.5 ml-2 text-green-700 dark:text-green-400">
                <li>+ Active paid subscription</li>
                <li>+ Allocates money to other writers</li>
                <li>+ Has earnings from readers</li>
                <li>+ Verified email address</li>
                <li>+ Multiple interconnected pages</li>
                <li>+ Account age 30+ days</li>
              </ul>
            </div>

            <div className="space-y-1">
              <p className="font-medium">Suspicious Signals (Lower Score):</p>
              <ul className="space-y-0.5 ml-2 text-red-700 dark:text-red-400">
                <li>- External links without internal links</li>
                <li>- High external-to-internal link ratio</li>
                <li>- New unverified account</li>
                <li>- VPN/proxy/datacenter IP</li>
                <li>- No financial engagement</li>
                <li>- Rapid action velocity</li>
                <li>- Bot-like behavior patterns</li>
              </ul>
            </div>
          </div>
        </details>

        <div className="text-[10px] text-muted-foreground">
          Score is used for spam filtering in activity feeds and triggering security challenges.
        </div>
      </div>
    </div>
  );
}

export default RiskAssessmentSection;
