import { CronSchedule } from '../types';

/**
 * Helper to calculate next cron run time (simplified version)
 */
export function getNextCronRun(schedule: string): Date {
  const now = new Date();
  const parts = schedule.split(' ');
  const minute = parseInt(parts[0]);
  const hour = parseInt(parts[1]);
  const dayOfMonth = parts[2];
  const dayOfWeek = parts[4];

  const next = new Date(now);
  next.setMinutes(minute);
  next.setSeconds(0);
  next.setMilliseconds(0);

  if (dayOfMonth !== '*') {
    // Monthly cron
    next.setDate(parseInt(dayOfMonth));
    next.setHours(hour);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
  } else if (dayOfWeek !== '*') {
    // Weekly cron
    const targetDay = parseInt(dayOfWeek);
    const currentDay = now.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0) daysUntil += 7;
    if (daysUntil === 0 && (now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute))) {
      daysUntil = 7;
    }
    next.setDate(now.getDate() + daysUntil);
    next.setHours(hour);
  } else {
    // Daily cron
    next.setHours(hour);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
  }

  return next;
}

/**
 * Format time until a date in a human-readable way
 */
export function formatTimeUntil(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  // Format the actual date/time
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });

  // Show relative + absolute time
  if (minutes < 60) {
    return `in ${minutes}m · ${timeStr}`;
  }
  if (hours < 24) {
    return `in ${hours}h ${minutes % 60}m · ${timeStr}`;
  }
  if (days < 7) {
    return `${dateStr} · ${timeStr}`;
  }
  return `${dateStr} · ${timeStr}`;
}

/**
 * Cron job schedule info for the Events tab
 * Jobs marked as isSystemJob: true are backend processing jobs that don't send user-facing emails
 */
/**
 * Maps template IDs to their corresponding cron schedule IDs
 * Used to show "upcoming" indicators on templates
 */
export const templateToCronMap: Record<string, string> = {
  'weekly-digest': 'weekly-digest',
  'first-page-activation': 'first-page-activation',
  'choose-username': 'username-reminder',
  'verify-to-choose-username': 'verify-to-choose-username',
  'payout-setup-reminder': 'payout-setup-reminder',
  'verification-reminder': 'email-verification-reminder',
  'reactivation': 'reactivation',
};

export function getCronSchedules(): CronSchedule[] {
  return [
    {
      id: 'process-writer-earnings',
      name: 'Process Writer Earnings',
      path: '/api/usd/process-writer-earnings',
      schedule: '0 8 1 * *',
      description: 'Backend job: Processes writer earnings on the 1st of each month at 8am UTC',
      nextRun: getNextCronRun('0 8 1 * *'),
      isSystemJob: true, // Backend processing - no user-facing emails
    },
    {
      id: 'automated-payouts',
      name: 'Automated Payouts',
      path: '/api/cron/automated-payouts',
      schedule: '0 9 1 * *',
      description: 'Backend job: Processes automated payouts on the 1st of each month at 9am UTC',
      nextRun: getNextCronRun('0 9 1 * *'),
      isSystemJob: true, // Backend processing - sends payout confirmation after processing
    },
    {
      id: 'weekly-digest',
      name: 'Weekly Digest',
      path: '/api/cron/weekly-digest',
      schedule: '0 10 * * 1',
      description: 'Sends weekly digest emails every Monday at 10am UTC',
      nextRun: getNextCronRun('0 10 * * 1'),
      isSystemJob: false,
    },
    {
      id: 'first-page-activation',
      name: 'First Page Activation',
      path: '/api/cron/first-page-activation',
      schedule: '0 13 * * *',
      description: 'Sends activation emails daily at 1pm UTC to users 2-7 days old who haven\'t created a page',
      nextRun: getNextCronRun('0 13 * * *'),
      isSystemJob: false,
    },
    {
      id: 'username-reminder',
      name: 'Username Reminder',
      path: '/api/cron/username-reminder',
      schedule: '0 14 * * *',
      description: 'Reminds VERIFIED users to set usernames daily at 2pm UTC',
      nextRun: getNextCronRun('0 14 * * *'),
      isSystemJob: false,
    },
    {
      id: 'verify-to-choose-username',
      name: 'Verify to Choose Username',
      path: '/api/admin/trigger-cron',
      schedule: '0 14 * * *',
      description: 'Sends combined verify+username email daily at 2pm UTC to unverified users without usernames',
      nextRun: getNextCronRun('0 14 * * *'),
      isSystemJob: false,
    },
    {
      id: 'payout-setup-reminder',
      name: 'Payout Setup Reminder',
      path: '/api/cron/payout-setup-reminder',
      schedule: '0 15 * * *',
      description: 'Reminds users to set up payouts daily at 3pm UTC',
      nextRun: getNextCronRun('0 15 * * *'),
      isSystemJob: false,
    },
    {
      id: 'email-verification-reminder',
      name: 'Email Verification Reminder',
      path: '/api/cron/email-verification-reminder',
      schedule: '0 16 * * *',
      description: 'Reminds unverified users to verify email daily at 4pm UTC',
      nextRun: getNextCronRun('0 16 * * *'),
      isSystemJob: false,
    },
    {
      id: 'reactivation',
      name: 'Re-activation (Inactive Users)',
      path: '/api/cron/reactivation',
      schedule: '0 16 * * 1',
      description: 'Sends re-activation emails weekly on Mondays at 4pm UTC to users inactive 30-90 days',
      nextRun: getNextCronRun('0 16 * * 1'),
      isSystemJob: false,
    },
  ];
}
