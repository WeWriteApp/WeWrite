import { EmailTemplate } from './types';

// Templates that target inactive users (for re-activation drip campaigns)
export const INACTIVE_USER_TEMPLATES = ['reactivation'];

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
