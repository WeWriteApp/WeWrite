/**
 * Page Score Breakdown Component
 *
 * Displays detailed breakdown of a page's quality score.
 * Shows each factor's contribution to the overall score.
 *
 * @see app/services/PageScoringService.ts
 */

'use client';

import React from 'react';
import { Icon } from '../ui/Icon';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  PAGE_SCORE_FACTOR_INFO,
  PAGE_SCORE_LEVELS,
  getPageScoreLevelFromScore
} from '../../constants/page-scoring';
import { PageScoreBadge } from './PageScoreBadge';

interface PageScoreFactors {
  externalRatio: number;
  internalUserLinks: number;
  showAuthorLinks: number;
  backlinks: number;
}

interface PageScoreBreakdownProps {
  isOpen: boolean;
  onClose: () => void;
  pageTitle: string;
  pageScore: number | null | undefined;
  pageScoreFactors?: PageScoreFactors | null;
}

function FactorRow({
  factorKey,
  score,
  maxScore = 25,
}: {
  factorKey: keyof typeof PAGE_SCORE_FACTOR_INFO;
  score: number;
  maxScore?: number;
}) {
  const info = PAGE_SCORE_FACTOR_INFO[factorKey];
  const percentage = Math.min(100, (score / maxScore) * 100);

  // Higher score = better quality
  const getScoreColor = (score: number) => {
    if (score >= 20) return 'text-green-600 dark:text-green-400';
    if (score >= 15) return 'text-blue-600 dark:text-blue-400';
    if (score >= 10) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getProgressColor = (score: number) => {
    if (score >= 20) return 'bg-green-500';
    if (score >= 15) return 'bg-blue-500';
    if (score >= 10) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name={info.icon as any} size={14} className="text-muted-foreground" />
          <span className="text-sm font-medium">{info.label}</span>
        </div>
        <span className={`text-sm font-semibold ${getScoreColor(score)}`}>
          {score}/{maxScore}
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all duration-300 ${getProgressColor(score)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{info.scoreExplanation}</p>
    </div>
  );
}

export function PageScoreBreakdown({
  isOpen,
  onClose,
  pageTitle,
  pageScore,
  pageScoreFactors,
}: PageScoreBreakdownProps) {
  if (pageScore === null || pageScore === undefined) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="FileText" size={18} />
              Page Quality Score
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Icon name="HelpCircle" size={32} className="mb-2" />
            <p>No score available for this page</p>
            <p className="text-sm mt-1">Score will be calculated on next save</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const level = getPageScoreLevelFromScore(pageScore);
  const levelInfo = PAGE_SCORE_LEVELS[level];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="FileText" size={18} />
            Page Quality Score
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 px-6 pb-6">
          {/* Page Title */}
          <div className="text-sm text-muted-foreground truncate">
            {pageTitle}
          </div>

          {/* Overall Score */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm text-muted-foreground">Overall Quality</p>
              <p className="text-2xl font-bold">{pageScore}/100</p>
              <p className="text-sm text-muted-foreground mt-1">
                {levelInfo.description}
              </p>
            </div>
            <PageScoreBadge
              score={pageScore}
              showScore={false}
              showTooltip={false}
              size="lg"
            />
          </div>

          {/* Score Note */}
          <div className="flex items-start gap-2 p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
            <Icon name="Info" size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Higher scores indicate higher quality pages. A score of 100 means excellent community engagement.
            </p>
          </div>

          {/* Factor Breakdown */}
          {pageScoreFactors && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Icon name="BarChart2" size={14} />
                Factor Breakdown
              </h4>

              <div className="space-y-4">
                <FactorRow
                  factorKey="externalRatio"
                  score={pageScoreFactors.externalRatio}
                />
                <FactorRow
                  factorKey="internalUserLinks"
                  score={pageScoreFactors.internalUserLinks}
                />
                <FactorRow
                  factorKey="showAuthorLinks"
                  score={pageScoreFactors.showAuthorLinks}
                />
                <FactorRow
                  factorKey="backlinks"
                  score={pageScoreFactors.backlinks}
                />
              </div>
            </div>
          )}

          {!pageScoreFactors && (
            <div className="text-sm text-muted-foreground text-center py-4">
              Factor breakdown not available.
              <br />
              Re-save the page to generate detailed scoring.
            </div>
          )}

          {/* Improvement Tips */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Icon name="Lightbulb" size={14} />
              How to Improve
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-start gap-2">
                <Icon name="Link" size={12} className="mt-0.5 shrink-0" />
                Add internal links to other users&apos; pages
              </li>
              <li className="flex items-start gap-2">
                <Icon name="UserCheck" size={12} className="mt-0.5 shrink-0" />
                Use &quot;Show Author&quot; on internal links to credit creators
              </li>
              <li className="flex items-start gap-2">
                <Icon name="Link2" size={12} className="mt-0.5 shrink-0" />
                Create valuable content that others want to link to
              </li>
              <li className="flex items-start gap-2">
                <Icon name="ExternalLink" size={12} className="mt-0.5 shrink-0" />
                Balance external links with internal community links
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PageScoreBreakdown;
