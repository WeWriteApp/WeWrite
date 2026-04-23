"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../components/ui/use-toast";
import { adminFetch } from "../../../utils/adminFetch";
import { RiskAssessmentSection } from "../../../components/admin/RiskAssessmentSection";
import { formatRelativeTime } from "@/utils/formatRelativeTime";
import type { User, Activity, ActivityFilter } from "../types";

interface EmailLogEntry {
  id: string;
  templateId: string;
  templateName: string;
  subject: string;
  status: "sent" | "failed" | "bounced" | "delivered" | "scheduled";
  errorMessage?: string;
  sentAt: string;
}

interface PayoutRecord {
  id: string;
  userId: string;
  amountCents: number;
  amountDollars: number;
  status: string;
  stripePayoutId?: string | null;
  failureReason?: string | null;
  requestedAt: any;
  completedAt?: any;
  approvalRequired?: boolean;
  approvalFlags?: string[];
}

const formatDateTime = (dateValue: any): string => {
  if (!dateValue) return "—";
  try {
    const date =
      dateValue?.toDate?.() ||
      (dateValue?._seconds
        ? new Date(dateValue._seconds * 1000)
        : new Date(dateValue));
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);

  // Fetch user data
  const loadUser = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await adminFetch(
        `/api/admin/users?uid=${id}&includeFinancial=true`
      );
      const data = await res.json();
      if (!res.ok || !data.success || !data.user) {
        toast({
          title: "User not found",
          description: data.error || "Could not load user",
          variant: "destructive",
        });
        return;
      }
      setUser(data.user);
    } catch (err) {
      console.error("Failed to load user:", err);
      toast({
        title: "Error",
        description: "Failed to load user details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  // Fetch email logs
  const loadEmailLogs = useCallback(async () => {
    if (!id) return;
    setEmailLogsLoading(true);
    try {
      const res = await adminFetch(
        `/api/admin/email-logs?userId=${id}&limit=50`
      );
      const data = await res.json();
      if (data.success) {
        setEmailLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load email logs:", err);
    } finally {
      setEmailLogsLoading(false);
    }
  }, [id]);

  // Fetch activity
  const loadActivities = useCallback(
    async (filter: ActivityFilter = "all") => {
      if (!id) return;
      setLoadingActivities(true);
      try {
        const res = await adminFetch(
          `/api/admin/users/activity?uid=${id}&filter=${filter}&limit=30`
        );
        const data = await res.json();
        if (!res.ok || data.error)
          throw new Error(data.error || "Failed to load activity");
        setActivities(data.activities || []);
      } catch (err) {
        console.error("Failed to load activity:", err);
        setActivities([]);
      } finally {
        setLoadingActivities(false);
      }
    },
    [id]
  );

  // Fetch payout history
  const loadPayouts = useCallback(async () => {
    if (!id) return;
    setPayoutsLoading(true);
    try {
      const res = await adminFetch(
        `/api/admin/payouts?userId=${id}&pageSize=50&sortOrder=desc`
      );
      const data = await res.json();
      if (data.success && data.data?.payouts) {
        setPayouts(data.data.payouts);
      }
    } catch (err) {
      console.error("Failed to load payouts:", err);
    } finally {
      setPayoutsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadUser();
    loadEmailLogs();
    loadPayouts();
  }, [loadUser, loadEmailLogs]);

  useEffect(() => {
    if (id) loadActivities(activityFilter);
  }, [id, activityFilter, loadActivities]);

  // Actions
  const handleToggleAdmin = async () => {
    if (!user) return;
    setActionLoading("admin");
    try {
      const res = await adminFetch("/api/admin/set-admin-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: user.uid,
          isAdmin: !user.isAdmin,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUser({ ...user, isAdmin: !user.isAdmin });
        toast({
          title: "Admin status updated",
          description: `${user.username || user.email} is ${!user.isAdmin ? "now an admin" : "no longer an admin"}`,
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update admin status",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendVerification = async () => {
    if (!user) return;
    setActionLoading("verify");
    try {
      const res = await adminFetch("/api/email/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
          username: user.username,
          idToken: "admin-bypass",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Verification email sent",
          description: `Sent to ${user.email}`,
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to send verification email",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async () => {
    if (!user) return;
    setActionLoading("reset");
    try {
      const res = await adminFetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, email: user.email }),
      });
      const data = await res.json();
      if (data.error) {
        toast({
          title: "Failed",
          description: data.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password reset link sent",
          description: `Reset link sent to ${user.email}`,
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to send password reset",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;
    const confirmed = confirm(
      `Are you sure you want to delete ${user.email}? This action cannot be undone.`
    );
    if (!confirmed) return;
    setActionLoading("delete");
    try {
      const res = await adminFetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid }),
      });
      const data = await res.json();
      if (data.error) {
        toast({
          title: "Failed",
          description: data.error,
          variant: "destructive",
        });
      } else {
        toast({ title: "User deleted", description: data.message });
        router.push("/admin/users");
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredActivities =
    activityFilter === "all"
      ? activities
      : activities.filter((a) => a.type === activityFilter);

  // Subscription badge
  const renderSubscription = () => {
    if (!user?.financial?.hasSubscription) {
      return <Badge variant="outline-static">No subscription</Badge>;
    }
    const status = user.financial.subscriptionStatus || "active";
    if (status === "active")
      return <Badge variant="success-secondary">Active</Badge>;
    if (status === "canceled")
      return <Badge variant="destructive-secondary">Canceled</Badge>;
    return <Badge variant="outline-static">{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon name="Loader" className="text-muted-foreground" size={24} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-center">
        <Icon
          name="UserX"
          size={48}
          className="mx-auto mb-3 text-muted-foreground"
        />
        <p className="text-muted-foreground mb-4">User not found</p>
        <Button variant="outline" onClick={() => router.push("/admin/users")}>
          <Icon name="ArrowLeft" size={14} className="mr-2" />
          Back to Users
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/users")}
            className="h-8 px-2"
          >
            <Icon name="ArrowLeft" size={16} />
          </Button>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              {user.username ? `@${user.username}` : user.email}
              {user.isAdmin && (
                <Badge variant="success-secondary" className="text-xs">
                  Admin
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        {user.username && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/u/${user.username}`, "_blank")}
          >
            <Icon name="ExternalLink" size={14} className="mr-1.5" />
            Public Profile
          </Button>
        )}
      </div>

      {/* Info Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 text-sm">
        <div className="space-y-1">
          <div className="text-muted-foreground">Admin</div>
          <div className="flex items-center gap-2">
            {user.isAdmin ? (
              <Badge variant="success-secondary">Admin</Badge>
            ) : (
              <Badge variant="outline-static">Not admin</Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleToggleAdmin}
              disabled={actionLoading === "admin"}
            >
              {actionLoading === "admin" ? (
                <Icon name="Loader" />
              ) : user.isAdmin ? (
                "Revoke"
              ) : (
                "Grant"
              )}
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground">Email verified</div>
          <div className="flex items-center gap-2">
            {user.emailVerified ? (
              <Badge variant="success-secondary">Verified</Badge>
            ) : (
              <>
                <Badge variant="destructive-secondary">Unverified</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={handleSendVerification}
                  disabled={actionLoading === "verify"}
                >
                  {actionLoading === "verify" ? (
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
        <div className="space-y-1">
          <div className="text-muted-foreground">Created</div>
          <div className="font-medium">{formatDateTime(user.createdAt)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground">Last login</div>
          <div className="font-medium">{formatDateTime(user.lastLogin)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground">Total pages</div>
          <div className="font-medium">{user.totalPages ?? "—"}</div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground">Stripe account</div>
          <div className="font-medium break-all text-xs">
            {user.stripeConnectedAccountId || "—"}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground">PWA</div>
          <div className="font-medium">
            {user.pwaInstalled ? (
              <Badge variant="success-secondary">Installed</Badge>
            ) : (
              <Badge variant="outline-static">Not installed</Badge>
            )}
          </div>
        </div>
        {user.referredBy && (
          <div className="space-y-1">
            <div className="text-muted-foreground">Referred by</div>
            <div className="font-medium">
              {user.referredByUsername ? (
                <button
                  className="text-primary hover:underline"
                  onClick={() =>
                    router.push(
                      `/admin/users/${user.referredBy}`
                    )
                  }
                >
                  @{user.referredByUsername}
                </button>
              ) : (
                <span className="font-mono text-xs">{user.referredBy}</span>
              )}
              {user.referralSource && (
                <span className="text-muted-foreground ml-1.5 text-xs">
                  via {user.referralSource}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Risk Assessment */}
      <RiskAssessmentSection userId={user.uid} />

      {/* Cards Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Subscription Card */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="CreditCard" size={16} className="text-blue-400" />
            <span className="font-medium">Subscription</span>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {renderSubscription()}
            {user.financial?.subscriptionAmount ? (
              <span className="text-muted-foreground text-xs">
                ${user.financial.subscriptionAmount.toFixed(2)} / mo
              </span>
            ) : null}
            {user.financial?.subscriptionCancelReason && (
              <span className="text-xs text-muted-foreground">
                Cancel reason: {user.financial.subscriptionCancelReason}
              </span>
            )}
          </div>
          {user.financial && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                Allocated:{" "}
                {user.financial.allocatedUsdCents != null
                  ? `$${(user.financial.allocatedUsdCents / 100).toFixed(2)}`
                  : "—"}
              </div>
              <div>
                Unallocated:{" "}
                {user.financial.unallocatedUsdCents != null
                  ? `$${(user.financial.unallocatedUsdCents / 100).toFixed(2)}`
                  : "—"}
              </div>
            </div>
          )}
        </div>

        {/* Payouts Card */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="Banknote" size={16} className="text-emerald-400" />
            <span className="font-medium">Payouts</span>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {user.financial?.payoutsSetup || user.stripeConnectedAccountId ? (
              <Badge variant="success-secondary">Connected</Badge>
            ) : (
              <Badge variant="outline-static">Not connected</Badge>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div>
              Available:{" "}
              {user.financial?.availableEarningsUsd != null
                ? `$${user.financial.availableEarningsUsd.toFixed(2)}`
                : "—"}
            </div>
            <div>
              This month:{" "}
              {user.financial?.earningsThisMonthUsd != null
                ? `$${user.financial.earningsThisMonthUsd.toFixed(2)}`
                : "—"}
            </div>
            <div>
              Total:{" "}
              {user.financial?.earningsTotalUsd != null
                ? `$${user.financial.earningsTotalUsd.toFixed(2)}`
                : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Payout History */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="ArrowDownToLine" size={16} className="text-emerald-400" />
          <span className="font-medium">Payout History</span>
          {payouts.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {payouts.length}
            </Badge>
          )}
        </div>
        {payoutsLoading ? (
          <div className="flex items-center justify-center py-4">
            <Icon name="Loader" className="text-muted-foreground" />
          </div>
        ) : payouts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No payouts yet</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {payouts.map((payout) => (
              <div
                key={payout.id}
                className="flex items-start justify-between gap-2 p-2 rounded bg-muted/30 text-xs"
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  {payout.status === "completed" || payout.status === "paid" ? (
                    <Icon
                      name="CheckCircle2"
                      size={14}
                      className="text-green-500 flex-shrink-0 mt-0.5"
                    />
                  ) : payout.status === "pending" || payout.status === "pending_approval" ? (
                    <Icon
                      name="Clock"
                      size={14}
                      className="text-blue-500 flex-shrink-0 mt-0.5"
                    />
                  ) : payout.status === "failed" || payout.status === "canceled" ? (
                    <Icon
                      name="XCircle"
                      size={14}
                      className="text-red-500 flex-shrink-0 mt-0.5"
                    />
                  ) : (
                    <Icon
                      name="CircleDot"
                      size={14}
                      className="text-muted-foreground flex-shrink-0 mt-0.5"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        ${payout.amountDollars.toFixed(2)}
                      </span>
                      <Badge
                        variant={
                          payout.status === "completed" || payout.status === "paid"
                            ? "success-secondary"
                            : payout.status === "failed" || payout.status === "canceled"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {payout.status}
                      </Badge>
                      {payout.approvalRequired && (
                        <Badge variant="outline-static" className="text-[10px]">
                          Approval required
                        </Badge>
                      )}
                    </div>
                    {payout.stripePayoutId && (
                      <p className="text-muted-foreground mt-0.5 font-mono text-[10px] truncate">
                        {payout.stripePayoutId}
                      </p>
                    )}
                    {payout.failureReason && (
                      <p className="text-red-500 mt-0.5">{payout.failureReason}</p>
                    )}
                    {payout.approvalFlags && payout.approvalFlags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {payout.approvalFlags.map((flag, i) => (
                          <span key={i} className="text-[10px] text-orange-500 bg-orange-500/10 rounded px-1">
                            {flag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right text-muted-foreground whitespace-nowrap flex-shrink-0">
                  <div>{formatDateTime(payout.requestedAt)}</div>
                  {payout.completedAt && (
                    <div className="text-green-600">
                      Completed {formatDateTime(payout.completedAt)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notification History */}
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
          <p className="text-xs text-muted-foreground">
            No notifications sent yet
          </p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {emailLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between gap-2 p-2 rounded bg-muted/30 text-xs"
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  {log.status === "sent" || log.status === "delivered" ? (
                    <Icon
                      name="CheckCircle2"
                      size={14}
                      className="text-green-500 flex-shrink-0 mt-0.5"
                    />
                  ) : log.status === "scheduled" ? (
                    <Icon
                      name="Clock"
                      size={14}
                      className="text-blue-500 flex-shrink-0 mt-0.5"
                    />
                  ) : log.status === "bounced" ? (
                    <Icon
                      name="MailWarning"
                      size={14}
                      className="text-orange-500 flex-shrink-0 mt-0.5"
                    />
                  ) : (
                    <Icon
                      name="XCircle"
                      size={14}
                      className="text-red-500 flex-shrink-0 mt-0.5"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">
                      {log.templateName || log.templateId}
                    </span>
                    {log.errorMessage && (
                      <p className="text-red-500 mt-0.5 truncate">
                        {log.errorMessage}
                      </p>
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

      {/* Activity Feed */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="Activity" size={16} className="text-violet-400" />
          <span className="font-medium">Activity</span>
        </div>
        <div className="flex gap-1 mb-3">
          {(
            ["all", "subscription", "payout", "notification"] as const
          ).map((f) => (
            <button
              key={f}
              onClick={() => setActivityFilter(f)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                activityFilter === f
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}s
            </button>
          ))}
        </div>
        {loadingActivities ? (
          <div className="flex items-center justify-center py-4">
            <Icon name="Loader" className="text-muted-foreground" />
          </div>
        ) : filteredActivities.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity found</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {filteredActivities.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-2 p-2 rounded bg-muted/30 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{a.title}</span>
                  {a.description && (
                    <p className="text-muted-foreground mt-0.5">
                      {a.description}
                    </p>
                  )}
                </div>
                {a.createdAt && (
                  <span className="text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {formatRelativeTime(a.createdAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-xs font-medium text-muted-foreground mb-3">
          Actions
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetPassword}
            disabled={!!actionLoading}
          >
            {actionLoading === "reset" ? (
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
            variant="outline"
            size="sm"
            onClick={loadUser}
            disabled={!!actionLoading}
          >
            <Icon name="RefreshCw" size={14} className="mr-2" />
            Refresh Data
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteUser}
            disabled={!!actionLoading}
          >
            {actionLoading === "delete" ? (
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
    </div>
  );
}
