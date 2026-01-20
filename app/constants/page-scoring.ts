/**
 * Page Scoring Constants and Documentation
 *
 * This file provides a single source of truth for page quality scoring information
 * used across the app:
 * - Admin PageScoreBreakdown component
 * - Activity feed filtering
 * - API documentation
 *
 * Note: Higher scores = BETTER quality (100 = excellent, 0 = poor)
 */

/**
 * Page score thresholds (higher = better)
 */
export const PAGE_SCORE_THRESHOLDS = {
  EXCELLENT: 75,  // 75-100: Well-connected, community-engaged
  GOOD: 50,       // 50-74: Some engagement
  FAIR: 25,       // 25-49: Limited community connection
  POOR: 0         // 0-24: Isolated or low-quality
} as const;

/**
 * Page score levels and their meanings
 */
export const PAGE_SCORE_LEVELS = {
  excellent: {
    label: 'Excellent',
    color: 'green',
    description: 'Well-connected, community-engaged page',
    range: '75-100'
  },
  good: {
    label: 'Good',
    color: 'blue',
    description: 'Some community engagement',
    range: '50-74'
  },
  fair: {
    label: 'Fair',
    color: 'yellow',
    description: 'Limited community connection',
    range: '25-49'
  },
  poor: {
    label: 'Poor',
    color: 'red',
    description: 'Isolated or potentially low-quality',
    range: '0-24'
  }
} as const;

/**
 * Page score factor information for documentation
 * Used in admin UI breakdown component
 *
 * Each factor contributes 0-25 points (higher = better)
 * Total max score: 100 (4 factors x 25 points)
 */
export const PAGE_SCORE_FACTOR_INFO = {
  externalRatio: {
    icon: 'ExternalLink',
    label: 'External Link Ratio',
    description: 'Ratio of external links to internal links. High external without internal is a spam signal.',
    scoreExplanation: '25 = No external links or balanced ratio. 0 = Only external links with no internal links.',
    maxScore: 25
  },
  internalUserLinks: {
    icon: 'Users',
    label: 'Links to Other Users',
    description: 'Internal links to pages owned by OTHER users (not your own). Shows community engagement.',
    scoreExplanation: '25 = 5+ links to other users\' pages. 0 = No links to other users\' content.',
    maxScore: 25
  },
  showAuthorLinks: {
    icon: 'UserCheck',
    label: 'Author Attribution',
    description: 'Links with "Show Author" enabled, crediting the page creator.',
    scoreExplanation: '25 = 3+ links with author attribution. 0 = No author attribution links.',
    maxScore: 25
  },
  backlinks: {
    icon: 'Link2',
    label: 'Backlinks Received',
    description: 'Other pages linking TO this page. Indicates valuable, reference-worthy content.',
    scoreExplanation: '25 = 5+ other pages link to this. 0 = No other pages link to this.',
    maxScore: 25
  }
} as const;

/**
 * Scoring thresholds for internal user links factor
 */
export const INTERNAL_USER_LINKS_SCORING = {
  EXCELLENT: { min: 5, score: 0 },   // 5+ links to other users
  GOOD: { min: 3, score: 5 },        // 3-4 links
  FAIR: { min: 2, score: 10 },       // 2 links
  MINIMAL: { min: 1, score: 15 },    // 1 link
  NONE: { min: 0, score: 25 }        // No links to other users
} as const;

/**
 * Scoring thresholds for show author links factor
 */
export const SHOW_AUTHOR_LINKS_SCORING = {
  EXCELLENT: { min: 3, score: 0 },   // 3+ show author links
  GOOD: { min: 2, score: 8 },        // 2 links
  MINIMAL: { min: 1, score: 15 },    // 1 link
  NONE: { min: 0, score: 25 }        // No show author links
} as const;

/**
 * Scoring thresholds for backlinks factor
 */
export const BACKLINKS_SCORING = {
  EXCELLENT: { min: 5, score: 0 },   // 5+ backlinks
  GOOD: { min: 3, score: 5 },        // 3-4 backlinks
  FAIR: { min: 2, score: 10 },       // 2 backlinks
  MINIMAL: { min: 1, score: 15 },    // 1 backlink
  NONE: { min: 0, score: 25 }        // No backlinks
} as const;

/**
 * Helper function to get page score level from score (higher = better)
 */
export function getPageScoreLevelFromScore(score: number): keyof typeof PAGE_SCORE_LEVELS {
  if (score >= PAGE_SCORE_THRESHOLDS.EXCELLENT) return 'excellent';
  if (score >= PAGE_SCORE_THRESHOLDS.GOOD) return 'good';
  if (score >= PAGE_SCORE_THRESHOLDS.FAIR) return 'fair';
  return 'poor';
}

/**
 * Helper function to get page score color from score
 */
export function getPageScoreColorFromScore(score: number): string {
  const level = getPageScoreLevelFromScore(score);
  return PAGE_SCORE_LEVELS[level].color;
}

/**
 * Helper function to get page score label from score
 */
export function getPageScoreLabelFromScore(score: number): string {
  const level = getPageScoreLevelFromScore(score);
  return PAGE_SCORE_LEVELS[level].label;
}
