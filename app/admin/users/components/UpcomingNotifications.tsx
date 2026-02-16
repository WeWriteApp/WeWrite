import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '../../../components/ui/badge';
import type { User } from '../types';

export function UpcomingNotifications({ user }: { user: User }) {
  const [loading, setLoading] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Array<{
    id: string;
    name: string;
    reason: string;
    eligible: boolean;
    nextSendDate?: string;
  }>>([]);

  React.useEffect(() => {
    const calculateUpcoming = () => {
      setLoading(true);
      const upcoming: typeof notifications = [];

      if (!user.emailVerified) {
        upcoming.push({
          id: 'verification-reminder',
          name: 'Email Verification Reminder',
          reason: 'User has not verified their email',
          eligible: true,
          nextSendDate: 'Next cron run (daily)'
        });
      }

      const hasAutoUsername = user.username?.startsWith('user_') || !user.username;
      if (hasAutoUsername) {
        upcoming.push({
          id: 'username-reminder',
          name: 'Choose Username Reminder',
          reason: 'User has auto-generated or no username',
          eligible: true,
          nextSendDate: 'Next cron run (daily)'
        });
      }

      const hasEarnings = (user.financial?.availableEarningsUsd ?? 0) >= 25;
      const hasStripe = !!user.stripeConnectedAccountId || user.financial?.payoutsSetup;
      if (hasEarnings && !hasStripe) {
        upcoming.push({
          id: 'payout-setup-reminder',
          name: 'Payout Setup Reminder',
          reason: `Has $${(user.financial?.availableEarningsUsd ?? 0).toFixed(2)} available but no payout method`,
          eligible: true,
          nextSendDate: 'Next cron run (daily)'
        });
      }

      const lastActive = user.lastLogin;
      if (lastActive) {
        const lastActiveDate = lastActive?.toDate?.() ||
          (lastActive?._seconds ? new Date(lastActive._seconds * 1000) : new Date(lastActive));
        const daysSinceActive = Math.floor((Date.now() - lastActiveDate.getTime()) / (24 * 60 * 60 * 1000));
        if (daysSinceActive >= 30) {
          upcoming.push({
            id: 'reactivation',
            name: 'Reactivation Email',
            reason: `User inactive for ${daysSinceActive} days`,
            eligible: true,
            nextSendDate: 'Next cron run (weekly)'
          });
        }
      }

      setNotifications(upcoming);
      setLoading(false);
    };

    calculateUpcoming();
  }, [user]);

  if (loading) {
    return <div className="flex items-center gap-2"><Icon name="Loader" /> Checking...</div>;
  }

  const eligibleNotifications = notifications.filter(n => n.eligible);

  return (
    <div className="space-y-3">
      {eligibleNotifications.length === 0 ? (
        <div className="text-center py-2">No upcoming automated emails for this user.</div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-medium text-foreground mb-2">Will receive:</div>
          {eligibleNotifications.map(n => (
            <div key={n.id} className="flex items-start justify-between gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
              <div className="flex-1">
                <div className="font-medium text-amber-600 dark:text-amber-400">{n.name}</div>
                <div className="text-xs text-muted-foreground">{n.reason}</div>
              </div>
              <Badge variant="outline" className="text-xs shrink-0">{n.nextSendDate}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
