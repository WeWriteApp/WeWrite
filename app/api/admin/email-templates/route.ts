/**
 * Email Templates API Route
 * 
 * GET /api/admin/email-templates - Get all email templates
 * GET /api/admin/email-templates?id=xxx - Get a specific template preview
 */

import { NextRequest, NextResponse } from 'next/server';
import { emailTemplates, getTemplateById } from '../../../lib/emailTemplates';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const templateId = searchParams.get('id');
  const withHtml = searchParams.get('html') === 'true';

  // Get a specific template
  if (templateId) {
    const template = getTemplateById(templateId);
    
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Generate preview HTML with sample data
    const previewHtml = template.generateHtml(template.sampleData);

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
}
