"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  SideDrawer,
  SideDrawerContent,
  SideDrawerHeader,
  SideDrawerBody,
  SideDrawerFooter,
  SideDrawerTitle,
  SideDrawerDescription,
} from '../ui/side-drawer';
import { adminFetch } from '../../utils/adminFetch';
import { useToast } from '../ui/use-toast';
import { RiskAssessmentSection } from './RiskAssessmentSection';

// Types
interface UserFinancialInfo {
  hasSubscription: boolean;
  subscriptionAmount?: number | null;
  subscriptionStatus?: string | null;
  subscriptionCancelReason?: string | null;
  availableEarningsUsd?: number;
  payoutsSetup: boolean;
  earningsTotalUsd?: number;
  earningsThisMonthUsd?: number;
}

interface UserDetails {
  uid: string;
  email: string;
  username?: string;
  createdAt?: any;
  lastLogin?: any;
  totalPages?: number;
  stripeConnectedAccountId?: string | null;
  isAdmin?: boolean;
  emailVerified?: boolean;
  referredBy?: string;
  referredByUsername?: string;
  referralSource?: string;
  financial?: UserFinancialInfo;
}

interface EmailLogEntry {
  id: string;
  templateId: string;
  templateName: string;
  recipientEmail: string;
  recipientUserId?: string;
  recipientUsername?: string;
  subject: string;
  status: 'sent' | 'failed' | 'bounced' | 'delivered' | 'scheduled';
  resendId?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  sentAt: string;
  createdAt: string;
}

interface CronRecipient {
  userId: string;
  email: string;
  username?: string;
  type: string;
  reason?: string;
}

interface CronSchedule {
  id: string;
  name: string;
  nextRun: Date;
}

interface UserDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string | null;
  username?: string | null;
  // Optional: pass in pre-fetched cron recipients data to avoid re-fetching
  cronRecipients?: Record<string, { loading: boolean; recipients: CronRecipient[] }>;
  cronSchedules?: CronSchedule[];
  // Callback when user wants to preview an email
  onEmailPreview?: (templateId: string, templateName: string, userId?: string, username?: string, reason?: string) => void;
  // Callback when user clicks another user (e.g., referrer)
  onUserClick?: (userId?: string, username?: string) => void;
}

// Helper functions
const formatUserDateTime = (dateValue: any): string => {
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
};

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const formatTimeUntil = (date: Date) => {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 0) return 'now';
  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffHours < 24) return `in ${diffHours}h`;
  return `in ${diffDays}d`;
};

export function UserDetailsDrawer({
  open,
  onOpenChange,
  userId,
  username,
  cronRecipients,
  cronSchedules,
  onEmailPreview,
  onUserClick,
}: UserDetailsDrawerProps) {
  const { toast } = useToast();

  // State
  const [loading, setLoading] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);
  const [adminToggleLoading, setAdminToggleLoading] = useState(false);
  const [verificationEmailLoading, setVerificationEmailLoading] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);

  // Load user details when drawer opens
  useEffect(() => {
    if (!open || (!userId && !username)) {
      setUserDetails(null);
      setEmailLogs([]);
      return;
    }

    const loadUserDetails = async () => {
      setLoading(true);
      setEmailLogsLoading(true);

      try {
        // Fetch user details and email logs in parallel
        const [usersResponse, logsResponse] = await Promise.all([
          adminFetch('/api/admin/users?includeFinancial=true&limit=1000'),
          userId ? adminFetch(`/api/admin/email-logs?userId=${userId}&limit=50`) : Promise.resolve(null)
        ]);

        const usersData = await usersResponse.json();

        if (usersData.users) {
          const foundUser = usersData.users.find((u: UserDetails) =>
            (userId && u.uid === userId) || (username && u.username === username)
          );

          if (foundUser) {
            setUserDetails(foundUser);

            // If we didn't have userId initially but found user, fetch logs now
            if (!userId && foundUser.uid) {
              const logsRes = await adminFetch(`/api/admin/email-logs?userId=${foundUser.uid}&limit=50`);
              const logsData = await logsRes.json();
              if (logsData.success) {
                setEmailLogs(logsData.logs || []);
              }
            }
          } else {
            toast({
              title: 'User not found',
              description: `Could not find user ${username || userId}`,
              variant: 'destructive',
            });
            onOpenChange(false);
          }
        }

        // Process email logs if we fetched them in parallel
        if (logsResponse) {
          const logsData = await logsResponse.json();
          if (logsData.success) {
            setEmailLogs(logsData.logs || []);
          }
        }
      } catch (error) {
        console.error('Failed to load user details:', error);
        toast({
          title: 'Error',
          description: 'Failed to load user details',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
        setEmailLogsLoading(false);
      }
    };

    loadUserDetails();
  }, [open, userId, username, toast, onOpenChange]);

  // Toggle admin status
  const handleToggleAdmin = async () => {
    if (!userDetails) return;

    setAdminToggleLoading(true);
    try {
      const response = await adminFetch('/api/admin/set-admin-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: userDetails.uid,
          isAdmin: !userDetails.isAdmin,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setUserDetails({
          ...userDetails,
          isAdmin: !userDetails.isAdmin,
        });
        toast({
          title: 'Admin status updated',
          description: `${userDetails.username || userDetails.email} is ${!userDetails.isAdmin ? 'now an admin' : 'no longer an admin'}`,
        });
      } else {
        toast({
          title: 'Failed to update admin status',
          description: data.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to toggle admin status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update admin status',
        variant: 'destructive',
      });
    } finally {
      setAdminToggleLoading(false);
    }
  };

  // Send verification email
  const handleSendVerificationEmail = async () => {
    if (!userDetails) return;

    setVerificationEmailLoading(true);
    try {
      const response = await adminFetch('/api/email/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userDetails.uid,
          email: userDetails.email,
          username: userDetails.username,
          idToken: 'admin-bypass',
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Verification email sent',
          description: `Sent to ${userDetails.email}`,
        });
      } else {
        toast({
          title: 'Failed to send verification email',
          description: data.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to send verification email:', error);
      toast({
        title: 'Error',
        description: 'Failed to send verification email',
        variant: 'destructive',
      });
    } finally {
      setVerificationEmailLoading(false);
    }
  };

  // Reset password
  const handleResetPassword = async () => {
    if (!userDetails) return;

    setResetPasswordLoading(true);
    try {
      const response = await adminFetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: userDetails.uid,
          email: userDetails.email
        }),
      });

      const data = await response.json();

      if (data.error) {
        toast({
          title: 'Failed to reset password',
          description: data.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Password reset link sent',
          description: `Reset link sent to ${userDetails.email}`,
        });
      }
    } catch (error) {
      console.error('Failed to reset password:', error);
      toast({
        title: 'Error',
        description: 'Failed to send password reset',
        variant: 'destructive',
      });
    } finally {
      setResetPasswordLoading(false);
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!userDetails) return;

    const confirmed = confirm(
      `Are you sure you want to delete ${userDetails.email}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeleteUserLoading(true);
    try {
      const response = await adminFetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userDetails.uid }),
      });

      const data = await response.json();

      if (data.error) {
        toast({
          title: 'Failed to delete user',
          description: data.error,
          variant: 'destructive',
        });
      } else {
        // Check if manual action is required (Firebase Auth user couldn't be deleted)
        if (data.manualActionRequired) {
          toast({
            title: 'User partially deleted',
            description: `${data.message}. Firebase Auth user must be deleted manually.`,
            variant: 'destructive',
          });
          // Open Firebase Console in new tab
          if (data.manualActionRequired.url) {
            window.open(data.manualActionRequired.url, '_blank');
          }
        } else if (data.warnings && data.warnings.length > 0) {
          toast({
            title: 'User deleted with warnings',
            description: data.warnings.join('. '),
          });
        } else {
          toast({
            title: 'User deleted',
            description: data.message || 'User successfully deleted',
          });
        }

        // Close the drawer after successful deletion
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete user',
        variant: 'destructive',
      });
    } finally {
      setDeleteUserLoading(false);
    }
  };

  // Render subscription badge
  const renderSubscription = (financial?: UserFinancialInfo) => {
    if (!financial?.hasSubscription) {
      return <Badge variant="outline-static">No subscription</Badge>;
    }
    const status = financial.subscriptionStatus || 'active';
    if (status === 'active') {
      return <Badge variant="success-secondary">Active</Badge>;
    }
    if (status === 'canceled') {
      return <Badge variant="destructive-secondary">Canceled</Badge>;
    }
    return <Badge variant="outline-static">{status}</Badge>;
  };

  // Render payout badge
  const renderPayout = (financial?: UserFinancialInfo, stripeId?: string | null) => {
    if (financial?.payoutsSetup || stripeId) {
      return <Badge variant="success-secondary">Connected</Badge>;
    }
    return <Badge variant="outline-static">Not connected</Badge>;
  };

  // Get upcoming notifications for this user from cronRecipients
  const getUserUpcomingNotifications = () => {
    if (!userDetails || !cronRecipients || !cronSchedules) return [];

    return Object.entries(cronRecipients)
      .flatMap(([cronId, data]) => {
        if (data.loading || !data.recipients) return [];
        const cronData = cronSchedules.find(c => c.id === cronId);
        if (!cronData) return [];
        return data.recipients
          .filter(r => r.userId === userDetails.uid)
          .map(r => ({
            cronId,
            cronName: cronData.name,
            nextRun: cronData.nextRun,
            reason: r.reason
          }));
      })
      .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime());
  };

  const userUpcoming = getUserUpcomingNotifications();

  return (
    <SideDrawer open={open} onOpenChange={onOpenChange}>
      <SideDrawerContent side="right" size="xl">
        <SideDrawerHeader>
          <SideDrawerTitle>User details</SideDrawerTitle>
          <SideDrawerDescription>
            View subscription, payout, and notification history for {userDetails?.email || 'user'}.
          </SideDrawerDescription>
        </SideDrawerHeader>

        <SideDrawerBody>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Icon name="Loader" className="text-muted-foreground" />
            </div>
          ) : userDetails ? (
            <div className="space-y-4 text-sm">
              {/* Basic Info Grid */}
              <div className="grid gap-3 grid-cols-2">
                <div>
                  <div className="text-muted-foreground">Email</div>
                  <div className="font-medium break-all">{userDetails.email}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Username</div>
                  <div className="font-medium">{userDetails.username || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Admin</div>
                  <div className="flex items-center gap-2">
                    {userDetails.isAdmin ? (
                      <Badge variant="success-secondary">Admin</Badge>
                    ) : (
                      <Badge variant="outline-static">Not admin</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={handleToggleAdmin}
                      disabled={adminToggleLoading}
                    >
                      {adminToggleLoading ? (
                        <Icon name="Loader" />
                      ) : userDetails.isAdmin ? (
                        'Revoke'
                      ) : (
                        'Grant'
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Email verified</div>
                  <div className="flex items-center gap-2">
                    {userDetails.emailVerified ? (
                      <Badge variant="success-secondary">Verified</Badge>
                    ) : (
                      <>
                        <Badge variant="destructive-secondary">Unverified</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={handleSendVerificationEmail}
                          disabled={verificationEmailLoading}
                        >
                          {verificationEmailLoading ? (
                            <Icon name="Loader" />
                          ) : (
                            <>
                              <Icon name="Mail" size={12} className="mr-1" />
                              Send
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Created</div>
                  <div className="font-medium">{formatUserDateTime(userDetails.createdAt)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Last login</div>
                  <div className="font-medium">{formatUserDateTime(userDetails.lastLogin)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total pages</div>
                  <div className="font-medium">{userDetails.totalPages ?? '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Stripe account</div>
                  <div className="font-medium break-all text-xs">{userDetails.stripeConnectedAccountId || '—'}</div>
                </div>
              </div>

              {/* Risk Assessment Section */}
              <RiskAssessmentSection userId={userDetails.uid} />

              {/* Subscription Card */}
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="CreditCard" size={16} className="text-blue-400" />
                  <span className="font-medium">Subscription</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {renderSubscription(userDetails.financial)}
                  {userDetails.financial?.subscriptionAmount ? (
                    <span className="text-muted-foreground text-xs">
                      ${userDetails.financial.subscriptionAmount.toFixed(2)} / mo
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Payouts Card */}
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="Banknote" size={16} className="text-emerald-400" />
                  <span className="font-medium">Payouts</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {renderPayout(userDetails.financial, userDetails.stripeConnectedAccountId)}
                  <span className="text-muted-foreground text-xs">
                    Available: {userDetails.financial?.availableEarningsUsd !== undefined
                      ? `$${userDetails.financial.availableEarningsUsd.toFixed(2)}`
                      : '—'}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Total: {userDetails.financial?.earningsTotalUsd !== undefined
                      ? `$${userDetails.financial.earningsTotalUsd.toFixed(2)}`
                      : '—'}
                  </span>
                </div>
              </div>

              {/* Referral Card */}
              {userDetails.referredBy && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="Users" size={16} className="text-purple-400" />
                    <span className="font-medium">Referral</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Referred by: </span>
                    {userDetails.referredByUsername ? (
                      <button
                        onClick={() => onUserClick?.(userDetails.referredBy, userDetails.referredByUsername)}
                        className="text-primary hover:underline"
                      >
                        @{userDetails.referredByUsername}
                      </button>
                    ) : (
                      <span className="font-mono text-xs">{userDetails.referredBy}</span>
                    )}
                    {userDetails.referralSource && (
                      <span className="text-muted-foreground ml-2">
                        via {userDetails.referralSource}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Upcoming Notifications Card */}
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="Calendar" size={16} className="text-orange-400" />
                  <span className="font-medium">Upcoming Notifications</span>
                </div>
                {userUpcoming.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No scheduled notifications</p>
                ) : (
                  <div className="space-y-2">
                    {userUpcoming.map((notif, idx) => (
                      <div
                        key={`${notif.cronId}-${idx}`}
                        className="flex items-start justify-between gap-2 p-2 rounded bg-muted/30 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <button
                            className="text-primary hover:underline font-medium flex items-center gap-1"
                            onClick={() => onEmailPreview?.(notif.cronId, notif.cronName, userDetails.uid, userDetails.username, notif.reason)}
                          >
                            <Icon name="Eye" size={12} />
                            {notif.cronName}
                          </button>
                          {notif.reason && (
                            <p className="text-muted-foreground mt-0.5 truncate">{notif.reason}</p>
                          )}
                        </div>
                        <span className="text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {formatTimeUntil(notif.nextRun)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notification History Card */}
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="History" size={16} className="text-blue-400" />
                  <span className="font-medium">Notification History</span>
                  {emailLogs.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {emailLogs.length}
                    </Badge>
                  )}
                </div>
                {emailLogsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Icon name="Loader" className="text-muted-foreground" />
                  </div>
                ) : emailLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No notifications sent yet</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {emailLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start justify-between gap-2 p-2 rounded bg-muted/30 text-xs"
                      >
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          {log.status === 'sent' || log.status === 'delivered' ? (
                            <Icon name="CheckCircle2" size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                          ) : log.status === 'scheduled' ? (
                            <Icon name="Clock" size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                          ) : log.status === 'bounced' ? (
                            <Icon name="MailWarning" size={14} className="text-orange-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Icon name="XCircle" size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <button
                              className="text-primary hover:underline font-medium flex items-center gap-1"
                              onClick={() => onEmailPreview?.(log.templateId, log.templateName || log.templateId, userDetails.uid, userDetails.username)}
                            >
                              <Icon name="Eye" size={12} />
                              {log.templateName || log.templateId}
                            </button>
                            {log.errorMessage && (
                              <p className="text-red-500 mt-0.5 truncate">{log.errorMessage}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {formatRelativeTime(log.sentAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Icon name="User" size={48} className="mx-auto mb-3 opacity-50" />
              <p>No user selected</p>
            </div>
          )}
        </SideDrawerBody>

        <SideDrawerFooter>
          <div className="flex flex-col gap-3 w-full">
            {/* Action buttons section */}
            {userDetails && (
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">Actions</div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetPassword}
                    disabled={resetPasswordLoading || deleteUserLoading}
                  >
                    {resetPasswordLoading ? (
                      <>
                        <Icon name="Loader" size={14} className="mr-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Icon name="Key" size={14} className="mr-2" />
                        Reset Password
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteUser}
                    disabled={resetPasswordLoading || deleteUserLoading}
                  >
                    {deleteUserLoading ? (
                      <>
                        <Icon name="Loader" size={14} className="mr-2" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Icon name="Trash2" size={14} className="mr-2" />
                        Delete User
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Footer navigation buttons */}
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {userDetails?.username && (
                <Button
                  variant="secondary"
                  onClick={() => window.open(`/u/${userDetails.username}`, '_blank')}
                >
                  <Icon name="ExternalLink" size={16} className="mr-2" />
                  View Public Profile
                </Button>
              )}
            </div>
          </div>
        </SideDrawerFooter>
      </SideDrawerContent>
    </SideDrawer>
  );
}
