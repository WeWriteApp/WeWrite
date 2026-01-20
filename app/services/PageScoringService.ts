/**
 * Page Scoring Service
 *
 * Calculates quality scores for pages based on link patterns and community engagement.
 * Lower scores = better quality (0 = excellent, 100 = poor).
 *
 * Factors (25 points each):
 * 1. External-to-Internal Ratio - High external without internal = spam signal
 * 2. Internal User Links - Links to OTHER users' pages (community engagement)
 * 3. Show Author Links - Attribution links with showAuthor: true
 * 4. Backlinks Received - Other pages linking to this page
 */

import { extractLinksFromNodes } from '../firebase/database/links';
import { getCollectionName } from '../utils/environmentConfig';
import {
  PAGE_SCORE_THRESHOLDS,
  INTERNAL_USER_LINKS_SCORING,
  SHOW_AUTHOR_LINKS_SCORING,
  BACKLINKS_SCORING,
  getPageScoreLevelFromScore
} from '../constants/page-scoring';
import type { EditorContent, LinkData } from '../types/database';

// ============================================================================
// Types
// ============================================================================

export interface PageScoreFactors {
  externalRatio: {
    score: number;
    externalCount: number;
    internalCount: number;
  };
  internalUserLinks: {
    score: number;
    count: number;
    linkedUserIds: string[];
  };
  showAuthorLinks: {
    score: number;
    count: number;
  };
  backlinks: {
    score: number;
    count: number;
  };
}

export interface PageScoreResult {
  score: number;
  level: 'excellent' | 'good' | 'fair' | 'poor';
  factors: PageScoreFactors;
  calculatedAt: Date;
}

export interface LinkStats {
  externalCount: number;
  internalCount: number;
  internalPageLinks: Array<{ pageId: string; showAuthor: boolean }>;
  showAuthorCount: number;
}

// ============================================================================
// Score Calculation Functions
// ============================================================================

/**
 * Calculate external-to-internal ratio score (0-25, lower is better)
 */
function calculateExternalRatioScore(externalCount: number, internalCount: number): number {
  if (externalCount === 0) return 0; // No external links = perfect
  if (internalCount === 0 && externalCount > 0) return 25; // All external, no internal = worst

  const ratio = externalCount / (internalCount + externalCount);
  return Math.round(ratio * 25);
}

/**
 * Calculate internal user links score (0-25, lower is better)
 * Links to OTHER users' pages show community engagement
 */
function calculateInternalUserLinksScore(linksToOtherUsers: number): number {
  if (linksToOtherUsers >= INTERNAL_USER_LINKS_SCORING.EXCELLENT.min) return INTERNAL_USER_LINKS_SCORING.EXCELLENT.score;
  if (linksToOtherUsers >= INTERNAL_USER_LINKS_SCORING.GOOD.min) return INTERNAL_USER_LINKS_SCORING.GOOD.score;
  if (linksToOtherUsers >= INTERNAL_USER_LINKS_SCORING.FAIR.min) return INTERNAL_USER_LINKS_SCORING.FAIR.score;
  if (linksToOtherUsers >= INTERNAL_USER_LINKS_SCORING.MINIMAL.min) return INTERNAL_USER_LINKS_SCORING.MINIMAL.score;
  return INTERNAL_USER_LINKS_SCORING.NONE.score;
}

/**
 * Calculate show author links score (0-25, lower is better)
 * Compound links with showAuthor indicate attribution/credit
 */
function calculateShowAuthorScore(showAuthorCount: number): number {
  if (showAuthorCount >= SHOW_AUTHOR_LINKS_SCORING.EXCELLENT.min) return SHOW_AUTHOR_LINKS_SCORING.EXCELLENT.score;
  if (showAuthorCount >= SHOW_AUTHOR_LINKS_SCORING.GOOD.min) return SHOW_AUTHOR_LINKS_SCORING.GOOD.score;
  if (showAuthorCount >= SHOW_AUTHOR_LINKS_SCORING.MINIMAL.min) return SHOW_AUTHOR_LINKS_SCORING.MINIMAL.score;
  return SHOW_AUTHOR_LINKS_SCORING.NONE.score;
}

/**
 * Calculate backlinks score (0-25, lower is better)
 * Being linked by others indicates valuable content
 */
function calculateBacklinksScore(backlinkCount: number): number {
  if (backlinkCount >= BACKLINKS_SCORING.EXCELLENT.min) return BACKLINKS_SCORING.EXCELLENT.score;
  if (backlinkCount >= BACKLINKS_SCORING.GOOD.min) return BACKLINKS_SCORING.GOOD.score;
  if (backlinkCount >= BACKLINKS_SCORING.FAIR.min) return BACKLINKS_SCORING.FAIR.score;
  if (backlinkCount >= BACKLINKS_SCORING.MINIMAL.min) return BACKLINKS_SCORING.MINIMAL.score;
  return BACKLINKS_SCORING.NONE.score;
}

// ============================================================================
// Main Service Class
// ============================================================================

export class PageScoringService {
  /**
   * Calculate page score from content and backlinks
   * This is the main entry point for scoring a page
   *
   * @param pageId - The page being scored
   * @param content - The page content (EditorContent array)
   * @param pageUserId - The userId of the page owner (to exclude self-links)
   * @param db - Firestore instance (admin SDK)
   */
  static async calculatePageScore(
    pageId: string,
    content: EditorContent | string,
    pageUserId: string,
    db: FirebaseFirestore.Firestore
  ): Promise<PageScoreResult> {
    // Parse content if it's a string
    let contentNodes: EditorContent;
    if (typeof content === 'string') {
      try {
        contentNodes = JSON.parse(content);
      } catch {
        contentNodes = [];
      }
    } else {
      contentNodes = content || [];
    }

    // Extract link statistics from content
    const linkStats = this.extractLinkStats(contentNodes);

    // Get page owners for linked pages to determine "links to other users"
    const linkedUserIds = await this.getLinkedPageOwners(
      linkStats.internalPageLinks.map(l => l.pageId),
      pageUserId,
      db
    );

    // Count links to OTHER users (not self-links)
    const linksToOtherUsers = linkedUserIds.filter(uid => uid !== pageUserId).length;

    // Get backlink count
    const backlinkCount = await this.getBacklinkCount(pageId, db);

    // Calculate factor scores
    const externalRatioScore = calculateExternalRatioScore(
      linkStats.externalCount,
      linkStats.internalCount
    );
    const internalUserLinksScore = calculateInternalUserLinksScore(linksToOtherUsers);
    const showAuthorScore = calculateShowAuthorScore(linkStats.showAuthorCount);
    const backlinksScore = calculateBacklinksScore(backlinkCount);

    // Total score (0-100)
    const totalScore = externalRatioScore + internalUserLinksScore + showAuthorScore + backlinksScore;

    // Determine level
    const level = getPageScoreLevelFromScore(totalScore);

    return {
      score: totalScore,
      level,
      factors: {
        externalRatio: {
          score: externalRatioScore,
          externalCount: linkStats.externalCount,
          internalCount: linkStats.internalCount
        },
        internalUserLinks: {
          score: internalUserLinksScore,
          count: linksToOtherUsers,
          linkedUserIds: linkedUserIds.filter(uid => uid !== pageUserId)
        },
        showAuthorLinks: {
          score: showAuthorScore,
          count: linkStats.showAuthorCount
        },
        backlinks: {
          score: backlinksScore,
          count: backlinkCount
        }
      },
      calculatedAt: new Date()
    };
  }

  /**
   * Extract link statistics from page content
   */
  static extractLinkStats(content: EditorContent): LinkStats {
    if (!content || !Array.isArray(content)) {
      return {
        externalCount: 0,
        internalCount: 0,
        internalPageLinks: [],
        showAuthorCount: 0
      };
    }

    const links = extractLinksFromNodes(content);

    let externalCount = 0;
    let internalCount = 0;
    const internalPageLinks: Array<{ pageId: string; showAuthor: boolean }> = [];
    let showAuthorCount = 0;

    for (const link of links) {
      if (link.type === 'external') {
        externalCount++;
      } else if (link.type === 'page' && link.pageId) {
        internalCount++;
        internalPageLinks.push({
          pageId: link.pageId,
          showAuthor: link.showAuthor === true
        });
        if (link.showAuthor) {
          showAuthorCount++;
        }
      } else if (link.type === 'user') {
        // User links are internal but not page links
        internalCount++;
      }
    }

    return {
      externalCount,
      internalCount,
      internalPageLinks,
      showAuthorCount
    };
  }

  /**
   * Get the userIds of linked pages to determine "links to other users"
   */
  static async getLinkedPageOwners(
    pageIds: string[],
    excludeUserId: string,
    db: FirebaseFirestore.Firestore
  ): Promise<string[]> {
    if (!pageIds || pageIds.length === 0) {
      return [];
    }

    // Deduplicate pageIds
    const uniquePageIds = [...new Set(pageIds)];

    // Batch fetch page documents to get their userIds
    const userIds: string[] = [];

    try {
      const pagesCollectionName = getCollectionName('pages');

      // Firestore IN queries support max 30 items, so batch if needed
      const batchSize = 30;
      for (let i = 0; i < uniquePageIds.length; i += batchSize) {
        const batch = uniquePageIds.slice(i, i + batchSize);

        // Use getAll for batch document fetches
        const docRefs = batch.map(id => db.collection(pagesCollectionName).doc(id));
        const snapshots = await db.getAll(...docRefs);

        for (const snap of snapshots) {
          if (snap.exists) {
            const data = snap.data();
            if (data?.userId) {
              userIds.push(data.userId);
            }
          }
        }
      }
    } catch (error) {
      // Non-fatal - return empty array
      console.error('[PageScoringService] Error fetching linked page owners:', error);
    }

    return userIds;
  }

  /**
   * Get backlink count for a page (how many other pages link to this one)
   */
  static async getBacklinkCount(pageId: string, db: FirebaseFirestore.Firestore): Promise<number> {
    try {
      const backlinksCollectionName = getCollectionName('backlinks');

      // Query backlinks collection for entries targeting this page
      const snapshot = await db.collection(backlinksCollectionName)
        .where('targetPageId', '==', pageId)
        .where('isPublic', '==', true)
        .count()
        .get();

      return snapshot.data().count;
    } catch (error) {
      // If count query not supported, fallback to getting docs
      try {
        const backlinksCollectionName = getCollectionName('backlinks');
        const snapshot = await db.collection(backlinksCollectionName)
          .where('targetPageId', '==', pageId)
          .where('isPublic', '==', true)
          .get();

        return snapshot.size;
      } catch {
        console.error('[PageScoringService] Error counting backlinks:', error);
        return 0;
      }
    }
  }

  /**
   * Quick score calculation without database queries (for previews)
   * Only calculates external ratio and show author from content
   */
  static calculateQuickScore(content: EditorContent): {
    score: number;
    level: 'excellent' | 'good' | 'fair' | 'poor';
    partialFactors: {
      externalRatio: number;
      showAuthorLinks: number;
    };
  } {
    const linkStats = this.extractLinkStats(content);

    const externalRatioScore = calculateExternalRatioScore(
      linkStats.externalCount,
      linkStats.internalCount
    );
    const showAuthorScore = calculateShowAuthorScore(linkStats.showAuthorCount);

    // Partial score (only 2 of 4 factors, max 50)
    // Scale to 0-100 for display purposes
    const partialScore = (externalRatioScore + showAuthorScore) * 2;
    const level = getPageScoreLevelFromScore(partialScore);

    return {
      score: partialScore,
      level,
      partialFactors: {
        externalRatio: externalRatioScore,
        showAuthorLinks: showAuthorScore
      }
    };
  }
}
