import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getEmailLogsByTemplate, getEmailLogsByUser, getRecentEmailLogs, getEmailStats } from '@/services/emailLogService';
import { withAdminContext } from '@/utils/adminRequestContext';

/**
 * Email Logs API for Admin
 *
 * GET /api/admin/email-logs - Get email send logs
 * Query params:
 *   - templateId: Filter by template ID
 *   - userId: Filter by recipient user ID
 *   - limit: Number of results (default 50)
 *   - stats: If true, return stats instead of logs
 */
export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
  try {
    // Verify admin access using session cookie
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json(
        { success: false, error: adminCheck.error || 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');
    const userId = searchParams.get('userId');
    const limitParam = searchParams.get('limit');
    const statsOnly = searchParams.get('stats') === 'true';
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    // Return stats if requested
    if (statsOnly) {
      const stats = await getEmailStats();
      return NextResponse.json({
        success: true,
        stats,
      });
    }

    // Get logs - prioritize userId filter, then templateId, then all
    let logs;
    if (userId) {
      logs = await getEmailLogsByUser(userId, limit);
    } else if (templateId) {
      logs = await getEmailLogsByTemplate(templateId, limit);
    } else {
      logs = await getRecentEmailLogs(limit);
    }

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('[Email Logs API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch email logs' },
      { status: 500 }
    );
  }
  }); // End withAdminContext
}
