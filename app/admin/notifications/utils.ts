import { EmailTemplate } from './types';

// Templates that target inactive users (for re-activation drip campaigns)
export const INACTIVE_USER_TEMPLATES = ['reactivation'];

/**
 * Transform email HTML for dark mode preview by replacing inline style values
 * This is necessary because inline styles override CSS rules (even with !important)
 */
export function transformEmailForDarkMode(html: string): string {
  let transformed = html;

  // Replace inline background colors
  transformed = transformed.replace(/style="([^"]*?)background:\s*#f9f9f9([^"]*?)"/g, 'style="$1background: #262626$2"');
  transformed = transformed.replace(/style="([^"]*?)background:\s*#fff([^"]*?)"/g, 'style="$1background: #333333$2"');
  transformed = transformed.replace(/style="([^"]*?)background:\s*#ffffff([^"]*?)"/g, 'style="$1background: #333333$2"');
  transformed = transformed.replace(/style="([^"]*?)background:\s*#f5f5f5([^"]*?)"/g, 'style="$1background: #333333$2"');
  transformed = transformed.replace(/style="([^"]*?)background:\s*#e5e7eb([^"]*?)"/g, 'style="$1background: #404040$2"');
  transformed = transformed.replace(/style="([^"]*?)background:\s*#fff4f4([^"]*?)"/g, 'style="$1background: #2a1a1a$2"');

  // Replace inline text colors
  transformed = transformed.replace(/style="([^"]*?)color:\s*#333([^"]*?)"/g, 'style="$1color: #e5e5e5$2"');
  transformed = transformed.replace(/style="([^"]*?)color:\s*#666([^"]*?)"/g, 'style="$1color: #a3a3a3$2"');
  transformed = transformed.replace(/style="([^"]*?)color:\s*#999([^"]*?)"/g, 'style="$1color: #737373$2"');
  transformed = transformed.replace(/style="([^"]*?)color:\s*#000([^"]*?)"/g, 'style="$1color: #ffffff$2"');

  // Replace inline border colors
  transformed = transformed.replace(/style="([^"]*?)border:\s*1px solid #eee([^"]*?)"/g, 'style="$1border: 1px solid #404040$2"');
  transformed = transformed.replace(/style="([^"]*?)border:\s*1px solid #ddd([^"]*?)"/g, 'style="$1border: 1px solid #404040$2"');
  transformed = transformed.replace(/style="([^"]*?)border:\s*1px solid #e5e7eb([^"]*?)"/g, 'style="$1border: 1px solid #404040$2"');
  transformed = transformed.replace(/style="([^"]*?)border:\s*1px solid #ffcccc([^"]*?)"/g, 'style="$1border: 1px solid #4a2020$2"');
  transformed = transformed.replace(/style="([^"]*?)border-color:\s*#eee([^"]*?)"/g, 'style="$1border-color: #404040$2"');

  // Add dark mode CSS for any remaining elements
  transformed = transformed.replace(
    '</head>',
    `<style>
      .email-body { background-color: #1a1a1a !important; }
      .dark-text { color: #e5e5e5 !important; }
      .dark-text-muted { color: #a3a3a3 !important; }
      .dark-text-heading { color: #ffffff !important; }
      .dark-card { background-color: #262626 !important; }
      .dark-card-inner { background-color: #333333 !important; border-color: #404040 !important; }
      .dark-footer { color: #737373 !important; }
      .dark-footer a { color: #737373 !important; }
      .dark-link { color: #60a5fa !important; }
      .dark-stat-box { background-color: #333333 !important; border-color: #404040 !important; }
      .dark-alert-security { background-color: #2a1a1a !important; border-color: #4a2020 !important; }
    </style></head>`
  );

  return transformed;
}

/**
 * Helper to split engagement templates into active vs inactive user categories
 */
export function splitEngagementTemplates(engagementTemplates: EmailTemplate[]) {
  const active = engagementTemplates.filter(t => !INACTIVE_USER_TEMPLATES.includes(t.id));
  const inactive = engagementTemplates.filter(t => INACTIVE_USER_TEMPLATES.includes(t.id));
  return { active, inactive };
}

/**
 * Format a relative time string from a date
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Format a user date/time value for display
 */
export function formatUserDateTime(dateValue: any): string {
  if (!dateValue) return '—';
  try {
    const date = dateValue?.toDate?.() ||
      (dateValue?._seconds ? new Date(dateValue._seconds * 1000) : new Date(dateValue));
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}
