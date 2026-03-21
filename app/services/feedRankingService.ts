/**
 * Feed Ranking Service
 *
 * Computes a composite feed score for ranking activity feed items
 * using signals that are native to WeWrite:
 *
 *   - Replies:    Other users writing agree/disagree/reply pages (strongest engagement signal)
 *   - Backlinks:  Other pages linking TO this page (community endorsement)
 *   - Supporters: USD allocations from subscribers (financial commitment)
 *   - Followers:  Users following the page author
 *   - Views:      Page views in last 24 hours (traffic/interest)
 *
 * Score formula:
 *   feedScore = (community * 0.40) + (quality * 0.20) + (freshness * 0.25) + (authorTrust * 0.15)
 *
 * "Community" replaces generic "engagement" — it measures real interactions
 * that are specific to WeWrite's collaborative writing model.
 */

export interface FeedItemSignals {
  // Community signals (WeWrite-native interactions)
  replyCount: number;      // Number of reply pages (agree/disagree/reply)
  backlinkCount: number;   // Number of other pages linking to this page
  supporterCount: number;  // Number of USD allocation supporters
  followerCount: number;   // Author's follower count
  views24h: number;        // Page views in last 24 hours

  // Quality signals
  pageScore: number | null; // 0–100 from PageScoringService (backlinks, internal links, attribution)

  // Freshness
  lastModified: string; // ISO date string

  // Author trust
  authorTrustScore: number; // 0–100
}

export interface FeedScore {
  total: number;
  community: number;
  quality: number;
  freshness: number;
  authorTrust: number;
}

const WEIGHTS = {
  community: 0.40,   // Replies, backlinks, supporters — the core of WeWrite
  quality: 0.20,     // Page score (link quality, attribution, backlinks)
  freshness: 0.25,   // Recency decay
  authorTrust: 0.15, // Author trustworthiness
} as const;

// Freshness half-life in hours — score halves every 48 hours
const FRESHNESS_HALF_LIFE_HOURS = 48;

/**
 * Normalize a value using logarithmic scaling.
 * Maps 0 → 0, and grows logarithmically toward 100.
 * The scale factor K controls how quickly it saturates.
 */
function logNormalize(value: number, k: number): number {
  if (value <= 0) return 0;
  return Math.min(100, Math.log10(value + 1) * k);
}

/**
 * Compute the community score (0–100) from WeWrite-native signals.
 *
 * Weighted by signal strength:
 *   - Replies (30%): Someone wrote an entire page in response — highest effort signal
 *   - Backlinks (25%): Another page references this one — community endorsement
 *   - Supporters (25%): Financial commitment — strong intent signal
 *   - Followers (10%): Author reputation
 *   - Views (10%): Traffic interest (weakest, but still useful)
 *
 * K values tuned for WeWrite scale:
 *   - 3 replies → ~72, 10 → ~100 (replies are rare and valuable)
 *   - 3 backlinks → ~72, 10 → ~100
 *   - 2 supporters → ~57, 5 → ~83
 *   - 10 followers → ~52, 50 → ~85
 *   - 50 views/day → ~56, 500 → ~89
 */
function computeCommunity(signals: {
  replyCount: number;
  backlinkCount: number;
  supporterCount: number;
  followerCount: number;
  views24h: number;
}): number {
  const replyScore = logNormalize(signals.replyCount, 75);
  const backlinkScore = logNormalize(signals.backlinkCount, 75);
  const supporterScore = logNormalize(signals.supporterCount, 60);
  const followerScore = logNormalize(signals.followerCount, 50);
  const viewScore = logNormalize(signals.views24h, 33);

  return (
    replyScore * 0.30 +
    backlinkScore * 0.25 +
    supporterScore * 0.25 +
    followerScore * 0.10 +
    viewScore * 0.10
  );
}

/**
 * Compute the freshness score (0–100) using exponential decay.
 */
function computeFreshness(lastModified: string): number {
  const modifiedTime = new Date(lastModified).getTime();
  if (isNaN(modifiedTime)) return 0;

  const hoursSinceModified = (Date.now() - modifiedTime) / (1000 * 60 * 60);
  if (hoursSinceModified < 0) return 100; // Future date, treat as fresh

  return 100 * Math.exp(-hoursSinceModified * Math.LN2 / FRESHNESS_HALF_LIFE_HOURS);
}

/**
 * Compute the composite feed score for a single item.
 */
export function computeFeedScore(signals: FeedItemSignals): FeedScore {
  const community = computeCommunity({
    replyCount: signals.replyCount,
    backlinkCount: signals.backlinkCount,
    supporterCount: signals.supporterCount,
    followerCount: signals.followerCount,
    views24h: signals.views24h,
  });
  const quality = signals.pageScore ?? 50; // Default to neutral if not scored
  const freshness = computeFreshness(signals.lastModified);
  const authorTrust = Math.max(0, Math.min(100, signals.authorTrustScore));

  const total =
    community * WEIGHTS.community +
    quality * WEIGHTS.quality +
    freshness * WEIGHTS.freshness +
    authorTrust * WEIGHTS.authorTrust;

  return {
    total: Math.round(total * 100) / 100,
    community: Math.round(community * 100) / 100,
    quality: Math.round(quality * 100) / 100,
    freshness: Math.round(freshness * 100) / 100,
    authorTrust: Math.round(authorTrust * 100) / 100,
  };
}

/**
 * Feed quality filter thresholds.
 * Maps quality level to the minimum author trust score required.
 * Pages with pageScore >= 50 get a 15-point reduction in the threshold.
 */
export const FEED_QUALITY_THRESHOLDS: Record<string, number> = {
  strict: 70,
  balanced: 40,
  relaxed: 15,
  off: 0,
};

/**
 * Check whether a feed item passes the quality filter.
 */
export function passesQualityFilter(
  authorTrustScore: number,
  pageScore: number | null,
  feedQuality: string,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  if (feedQuality === 'off') return true;

  const threshold = FEED_QUALITY_THRESHOLDS[feedQuality] ?? FEED_QUALITY_THRESHOLDS.balanced;

  // Quality content gets a trust threshold reduction
  const effectiveThreshold = (pageScore !== null && pageScore >= 50)
    ? Math.max(0, threshold - 15)
    : threshold;

  return authorTrustScore >= effectiveThreshold;
}
