/**
 * Email Templates API Route
 *
 * GET /api/admin/email-templates - Get all email templates
 * GET /api/admin/email-templates?id=xxx - Get a specific template preview
 * GET /api/admin/email-templates?id=xxx&userId=yyy - Get personalized preview for specific user
 */

import { NextRequest, NextResponse } from 'next/server';
import { emailTemplates, getTemplateById } from '../../../lib/emailTemplates';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';

// Map cronId to actual email template ID
// This is needed because cron job IDs don't always match template IDs
const CRON_TO_TEMPLATE_MAP: Record<string, string> = {
  'username-reminder': 'choose-username',
  'first-page-activation': 'first-page-activation',
  'email-verification-reminder': 'verification-reminder',
  // Cron jobs that process data but don't send user-facing emails
  // Map to generic/system templates for preview purposes
  'process-writer-earnings': 'generic-notification', // System job - no direct email to users
  'automated-payouts': 'payout-processed', // Maps to the payout confirmation email
};

export async function GET(request: NextRequest) {
  // Wrap the entire handler with admin context for proper environment detection
  return withAdminContext(request, async () => {
  const { searchParams } = new URL(request.url);
  let templateId = searchParams.get('id');
  const withHtml = searchParams.get('html') === 'true';
  const userId = searchParams.get('userId');
  const storedMetadata = searchParams.get('metadata'); // For viewing sent emails with original data

  // Get a specific template
  if (templateId) {
    // Try to get template directly, or map from cronId to templateId
    let template = getTemplateById(templateId);
    if (!template && CRON_TO_TEMPLATE_MAP[templateId]) {
      templateId = CRON_TO_TEMPLATE_MAP[templateId];
      template = getTemplateById(templateId);
    }

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // If userId is provided, fetch real user data for personalized preview
    let templateData = template.sampleData;
    let isPersonalized = false;
    let isFromStoredMetadata = false;

    // If stored metadata is provided (from sent email logs), use that instead of fetching fresh data
    if (storedMetadata && withHtml) {
      try {
        const parsedMetadata = JSON.parse(storedMetadata);
        // Merge stored metadata with sample data (sample data as fallback for missing fields)
        templateData = { ...template.sampleData, ...parsedMetadata };
        isPersonalized = true;
        isFromStoredMetadata = true;
      } catch (parseError) {
        console.error('[EMAIL TEMPLATES] Error parsing stored metadata:', parseError);
        // Fall back to sample data or user data fetch
      }
    }

    // If no stored metadata but userId is provided, fetch real user data for personalized preview
    if (!isFromStoredMetadata && userId && withHtml) {
      try {
        const admin = getFirebaseAdmin();
        if (admin) {
          const db = admin.firestore();
          const usersCollectionName = getCollectionName('users');
          const userDoc = await db.collection(usersCollectionName).doc(userId).get();

          if (userDoc.exists) {
            const userData = userDoc.data()!;
            isPersonalized = true;

            // Build personalized data based on template type
            const personalizedData: Record<string, any> = {
              username: userData.username || userData.displayName || 'there',
              email: userData.email,
              currentUsername: userData.username,
            };

            // Fetch additional data based on template type
            if (templateId === 'payout-setup-reminder') {
              // Get pending earnings for payout reminder
              const writerBalancesCollectionName = getCollectionName('writerUsdBalances');
              const balanceDoc = await db.collection(writerBalancesCollectionName).doc(userId).get();
              if (balanceDoc.exists) {
                const balanceData = balanceDoc.data()!;
                const pendingCents = balanceData.pendingUsdCents || 0;
                personalizedData.pendingEarnings = `$${(pendingCents / 100).toFixed(2)}`;
              } else {
                personalizedData.pendingEarnings = '$0.00';
              }
            }

            if (templateId === 'username-reminder') {
              personalizedData.currentUsername = userData.username || 'user_...';
            }

            if (templateId === 'reactivation') {
              const lastActiveAt = userData.lastActiveAt?.toDate?.() || userData.lastActiveAt;
              if (lastActiveAt) {
                const daysSinceActive = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / (24 * 60 * 60 * 1000));
                personalizedData.daysSinceActive = daysSinceActive;
              } else {
                personalizedData.daysSinceActive = 30;
              }
            }

            if (templateId === 'weekly-digest') {
              // For weekly digest, we'd need to fetch actual stats
              // For now, use placeholder values that indicate it's personalized
              personalizedData.pageViews = '(calculated at send time)';
              personalizedData.newFollowers = '(calculated at send time)';
              personalizedData.earningsThisWeek = '(calculated at send time)';
              personalizedData.trendingPages = template.sampleData.trendingPages;
            }

            // Merge personalized data with sample data (sample data as fallback)
            templateData = { ...template.sampleData, ...personalizedData };
          }
        }
      } catch (error) {
        console.error('[EMAIL TEMPLATES] Error fetching user data for preview:', error);
        // Fall back to sample data
      }
    }

    // Generate preview HTML with appropriate data
    const previewHtml = template.generateHtml(templateData);

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        subject: template.subject,
        sampleData: template.sampleData,
        ...(withHtml && { html: previewHtml }),
        ...(isPersonalized && { isPersonalized, personalizedData: templateData }),
        ...(isFromStoredMetadata && { isFromStoredMetadata }),
      },
    });
  }

  // Get all templates (metadata only, no HTML for list view)
  const templateList = emailTemplates.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    subject: t.subject,
  }));

  // Group by category
  const grouped = {
    authentication: templateList.filter(t => t.category === 'authentication'),
    payments: templateList.filter(t => t.category === 'payments'),
    engagement: templateList.filter(t => t.category === 'engagement'),
    system: templateList.filter(t => t.category === 'system'),
    notifications: templateList.filter(t => t.category === 'notifications'),
  };

  return NextResponse.json({
    success: true,
    templates: templateList,
    grouped,
    total: templateList.length,
  });
  }); // End withAdminContext
}
