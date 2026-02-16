import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { UpcomingNotifications } from './UpcomingNotifications';
import type { User, Activity, ActivityFilter } from '../types';
import {
  renderSubscription,
  renderPayout,
  formatDateTime,
  getActivityIcon,
  getActivityBadgeStyle,
  getStatusBadgeStyle,
} from '../utils';
import { PillLink, renderActivityDescription } from './ActivityHelpers';

interface MobileUserDetailsProps {
  selectedUser: User;
  loading: boolean;
  loadingAction: string | null;
  activityFilter: ActivityFilter;
  setActivityFilter: (f: ActivityFilter) => void;
  loadingActivities: boolean;
  filteredActivities: Activity[];
  toggleAdminUser: User | null;
  setToggleAdminUser: (u: User | null) => void;
  onSendEmailVerification: (user: User) => void;
  onSendPayoutReminder: (user: User) => void;
  onToggleAdminStatus: (user: User) => void;
}

export function MobileUserDetails({
  selectedUser,
  loading,
  loadingAction,
  activityFilter,
  setActivityFilter,
  loadingActivities,
  filteredActivities,
  toggleAdminUser,
  setToggleAdminUser,
  onSendEmailVerification,
  onSendPayoutReminder,
  onToggleAdminStatus,
}: MobileUserDetailsProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon name="Loader" className="text-muted-foreground" size={24} />
      </div>
    );
  }

  if (!selectedUser) {
    return (
      <div className="p-4 text-center">
        <Icon name="UserX" className="text-muted-foreground mx-auto mb-2" size={32} />
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 grid-cols-2">
          <div>
            <div className="text-muted-foreground">Email</div>
            <div className="font-medium break-all">{selectedUser.email}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Username</div>
            <div className="font-medium">{selectedUser.username || '—'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Admin</div>
            <button
              onClick={() => setToggleAdminUser(selectedUser)}
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity group"
              title={selectedUser.isAdmin ? "Click to remove admin" : "Click to make admin"}
            >
              {selectedUser.isAdmin ? (
                <Badge variant="success-secondary">Admin</Badge>
              ) : (
                <Badge variant="outline-static">Not admin</Badge>
              )}
              <Icon name="Pencil" size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </div>
          <div>
            <div className="text-muted-foreground">Email verified</div>
            <div className="flex items-center gap-2">
              {selectedUser.emailVerified ? (
                <Badge variant="success-secondary">Verified</Badge>
              ) : (
                <>
                  <Badge variant="destructive-secondary">Unverified</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onSendEmailVerification(selectedUser)}
                    disabled={loadingAction === 'verify'}
                  >
                    {loadingAction === 'verify' ? (
                      <Icon name="Loader" className="mr-1" />
                    ) : null}
                    Send reminder
                  </Button>
                </>
              )}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Created</div>
            <div className="font-medium">{formatDateTime(selectedUser.createdAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Last login</div>
            <div className="font-medium">{formatDateTime(selectedUser.lastLogin)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Total pages</div>
            <div className="font-medium">{selectedUser.totalPages ?? '—'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Stripe account</div>
            <div className="font-medium break-all text-xs">{selectedUser.stripeConnectedAccountId || '—'}</div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="CreditCard" size={16} className="text-blue-400" />
            <span className="font-medium">Subscription</span>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {renderSubscription(selectedUser.financial)}
            {selectedUser.financial?.subscriptionAmount ? (
              <span className="text-muted-foreground text-xs">
                ${selectedUser.financial.subscriptionAmount.toFixed(2)} / mo
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="Banknote" size={16} className="text-emerald-400" />
            <span className="font-medium">Payouts</span>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {renderPayout(selectedUser.financial, selectedUser.stripeConnectedAccountId)}
            <span className="text-muted-foreground text-xs">
              Available: {selectedUser.financial?.availableEarningsUsd !== undefined
                ? `$${selectedUser.financial.availableEarningsUsd.toFixed(2)}`
                : '—'}
            </span>
            <span className="text-muted-foreground text-xs">
              Total: {selectedUser.financial?.earningsTotalUsd !== undefined
                ? `$${selectedUser.financial.earningsTotalUsd.toFixed(2)}`
                : '—'}
            </span>
          </div>
          {(selectedUser.financial?.availableEarningsUsd ?? 0) > 0 && !(selectedUser.financial?.payoutsSetup || selectedUser.stripeConnectedAccountId) && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={loadingAction !== null}
                onClick={() => onSendPayoutReminder(selectedUser)}
              >
                {loadingAction === "notify" ? <Icon name="Loader" /> : "Send payout reminder"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Sends a notification reminding them to add a bank for payouts.
              </span>
            </div>
          )}
        </div>

        {/* Upcoming Notifications Section */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Icon name="Bell" size={16} className="text-amber-400" />
              <span className="font-medium">Upcoming Notifications</span>
            </div>
          </div>
          <div className="p-4 text-sm text-muted-foreground">
            <UpcomingNotifications user={selectedUser} />
          </div>
        </div>

        {/* Unified Activity Feed */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Icon name="Filter" size={16} className="text-muted-foreground" />
              <span className="font-medium">Activity Feed</span>
              {loadingActivities && <Icon name="Loader" className="text-muted-foreground" />}
            </div>
            <div className="flex gap-1">
              {(['all', 'subscription', 'payout', 'notification'] as const).map((filter) => (
                <Button
                  key={filter}
                  size="sm"
                  variant={activityFilter === filter ? 'secondary' : 'ghost'}
                  className="h-7 px-2 text-xs"
                  onClick={() => setActivityFilter(filter)}
                >
                  {filter === 'all' && 'All'}
                  {filter === 'subscription' && <><Icon name="CreditCard" size={12} className="mr-1" />Subs</>}
                  {filter === 'payout' && <><Icon name="Banknote" size={12} className="mr-1" />Payouts</>}
                  {filter === 'notification' && <><Icon name="Bell" size={12} className="mr-1" />Notifs</>}
                </Button>
              ))}
            </div>
          </div>

          <div className="max-h-80 overflow-auto">
            {filteredActivities.length === 0 && !loadingActivities ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No activity found{activityFilter !== 'all' ? ` for ${activityFilter}` : ''}.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredActivities.map((activity) => (
                  <div key={activity.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`mt-0.5 p-1.5 rounded-md border ${getActivityBadgeStyle(activity.type)}`}>
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{activity.title}</span>
                            {activity.status && (
                              <Badge className={`text-[10px] px-1.5 py-0 h-4 ${getStatusBadgeStyle(activity.status)}`}>
                                {activity.status}
                              </Badge>
                            )}
                            {activity.amount !== undefined && (
                              <span className="text-sm font-medium text-emerald-400">
                                ${activity.amount.toFixed(2)}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5">
                            {renderActivityDescription(activity)}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(activity.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: new Date(activity.createdAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin toggle dialog */}
      <Dialog open={!!toggleAdminUser} onOpenChange={(open) => !open && setToggleAdminUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toggleAdminUser?.isAdmin ? 'Revoke admin access' : 'Grant admin access'}
            </DialogTitle>
            <DialogDescription>
              {toggleAdminUser?.isAdmin
                ? `Remove admin privileges from ${toggleAdminUser?.email}? They will lose access to the admin dashboard.`
                : `Grant admin access to ${toggleAdminUser?.email}? They will be able to access the admin dashboard and manage users.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setToggleAdminUser(null)}
              disabled={loadingAction !== null}
            >
              Cancel
            </Button>
            <Button
              variant={toggleAdminUser?.isAdmin ? 'destructive' : 'default'}
              onClick={() => toggleAdminUser && onToggleAdminStatus(toggleAdminUser)}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'admin' ? (
                <Icon name="Loader" className="mr-1" />
              ) : null}
              {toggleAdminUser?.isAdmin ? 'Revoke access' : 'Grant access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
