/**
 * Risk Assessment API
 *
 * Provides risk scoring for actions to determine if challenges are needed.
 *
 * Endpoints:
 * - POST /api/risk-assessment - Full risk assessment for an action
 * - GET /api/risk-assessment?userId=xxx - Get user's risk level (admin only)
 *
 * @see app/services/RiskScoringService.ts
 * @see docs/security/ANTI_SPAM_SYSTEM.md
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  RiskScoringService,
  type ActionType,
  type RiskAssessmentInput
} from '../../services/RiskScoringService';
import { getUserIdFromRequest, createErrorResponse } from '../auth-helper';
import { getFirebaseAdmin } from '../../firebase/admin';
import { getCollectionName } from '../../utils/environmentConfig';

/**
 * POST /api/risk-assessment
 *
 * Perform a risk assessment for an action.
 * Used by client before sensitive actions to determine if challenge needed.
 *
 * Body:
 * {
 *   action: ActionType,
 *   sessionData?: { duration: number, interactions: number, pageViews: number },
 *   contentLength?: number,
 *   hasLinks?: boolean,
 *   linkCount?: number,
 *   fingerprint?: object
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     score: number,
 *     level: 'allow' | 'soft_challenge' | 'hard_challenge' | 'block',
 *     recommendation: string,
 *     reasons: string[],
 *     shouldChallenge: boolean,
 *     challengeType?: 'invisible' | 'visible'
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    // Get user agent
    const userAgent = request.headers.get('user-agent') || '';

    // Get authenticated user (optional)
    const userId = await getUserIdFromRequest(request);

    // Parse request body
    let body: Partial<RiskAssessmentInput>;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('BAD_REQUEST', 'Invalid JSON body');
    }

    // Validate action type
    const validActions: ActionType[] = [
      'login', 'register', 'create_page', 'edit_page',
      'create_reply', 'send_message', 'password_reset',
      'email_change', 'account_delete'
    ];

    if (!body.action || !validActions.includes(body.action)) {
      return createErrorResponse('BAD_REQUEST', `Invalid action. Must be one of: ${validActions.join(', ')}`);
    }

    // Build assessment input
    const input: RiskAssessmentInput = {
      action: body.action,
      userId: userId || undefined,
      ip,
      userAgent,
      fingerprint: body.fingerprint,
      sessionData: body.sessionData,
      contentLength: body.contentLength,
      hasLinks: body.hasLinks,
      linkCount: body.linkCount
    };

    // Perform risk assessment
    const assessment = await RiskScoringService.assessRisk(input);

    // Determine if challenge is needed
    const shouldChallenge = assessment.level === 'soft_challenge' || assessment.level === 'hard_challenge';
    const challengeType = assessment.level === 'soft_challenge' ? 'invisible' : assessment.level === 'hard_challenge' ? 'visible' : undefined;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        score: assessment.score,
        level: assessment.level,
        recommendation: assessment.recommendation,
        reasons: assessment.reasons,
        shouldChallenge,
        challengeType,
        // Don't expose full factors to client for security
        factors: {
          botDetection: { score: assessment.factors.botDetection.score },
          accountTrust: { trustLevel: assessment.factors.accountTrust.trustLevel },
          velocity: { exceededLimit: assessment.factors.velocity.exceededLimit }
        }
      }
    });
  } catch (error) {
    console.error('[risk-assessment] Error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to assess risk');
  }
}

/**
 * GET /api/risk-assessment?userId=xxx
 *
 * Get risk level for a specific user.
 * Admin only - used in admin dashboard.
 *
 * Query params:
 * - userId: The user to get risk level for
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     score: number,
 *     level: string,
 *     factors: RiskFactors,
 *     lastAssessment?: Date,
 *     history?: Array<{ timestamp, action, score, level, reasons }>
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const adminUserId = await getUserIdFromRequest(request);
    if (!adminUserId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    // Check admin permissions
    const isAdmin = await checkIsAdmin(adminUserId);
    if (!isAdmin) {
      return createErrorResponse('FORBIDDEN', 'Admin access required');
    }

    // Get userId from query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return createErrorResponse('BAD_REQUEST', 'userId query parameter required');
    }

    // Get user risk level
    const riskLevel = await RiskScoringService.getUserRiskLevel(userId);

    // Optionally get history
    const includeHistory = searchParams.get('history') === 'true';
    let history;
    if (includeHistory) {
      history = await RiskScoringService.getUserRiskHistory(userId, 10);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        userId,
        score: riskLevel.score,
        level: riskLevel.level,
        factors: riskLevel.factors,
        lastAssessment: riskLevel.lastAssessment?.toISOString(),
        ...(history && { history })
      }
    });
  } catch (error) {
    console.error('[risk-assessment] GET Error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to get risk level');
  }
}

/**
 * Check if a user has admin permissions
 */
async function checkIsAdmin(userId: string): Promise<boolean> {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      // In development, check for dev admin
      return userId === 'mP9yRa3nO6gS8wD4xE2hF5jK7m9N' || userId === 'dev_admin_user';
    }

    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
    const userData = userDoc.data();

    return userData?.role === 'admin' || userData?.isAdmin === true;
  } catch (error) {
    console.error('[risk-assessment] Error checking admin:', error);
    return false;
  }
}
