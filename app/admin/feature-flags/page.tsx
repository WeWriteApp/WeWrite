"use client";

import { useEffect, useState } from "react";
import { Icon } from '@/components/ui/Icon';
import { useRouter } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";
import { Switch } from "../../components/ui/switch";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";

export default function FeatureFlagsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [lineNumbersEnabled, setLineNumbersEnabled] = useState(false);
  const [lineNumbersGlobal, setLineNumbersGlobal] = useState(false);
  const [onboardingEnabled, setOnboardingEnabled] = useState(false);
  const [onboardingGlobal, setOnboardingGlobal] = useState(false);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [enabledUsers, setEnabledUsers] = useState<number | null>(null);
  const [onboardingEnabledUsers, setOnboardingEnabledUsers] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const enabledFraction =
    totalUsers && totalUsers > 0
      ? `${enabledUsers ?? 0}/${totalUsers}`
      : "—";
  const onboardingEnabledFraction =
    totalUsers && totalUsers > 0
      ? `${onboardingEnabledUsers ?? 0}/${totalUsers}`
      : "—";

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/auth/login?redirect=/admin/feature-flags");
        return;
      }
      if (!user.isAdmin) {
        router.push("/");
        return;
      }
      void loadFlags();
    }
  }, [isLoading, user, router]);

  const loadFlags = async () => {
    try {
      const res = await fetch("/api/feature-flags", { credentials: "include" });
      const data = await res.json();
      if (res.ok && data?.flags) {
        setLineNumbersEnabled(Boolean(data.flags.line_numbers));
        setOnboardingEnabled(Boolean(data.flags.onboarding_tutorial));
      }
      const summaryRes = await fetch("/api/feature-flags?summary=1", { credentials: "include" });
      const summaryData = await summaryRes.json();
      if (summaryRes.ok && summaryData?.summary) {
        setTotalUsers(summaryData.summary.totalUsers ?? null);
        setEnabledUsers(summaryData.summary.enabledCount ?? null);
        setLineNumbersGlobal(Boolean(summaryData.summary.defaultEnabled));
      }
      // Load onboarding tutorial summary
      const onboardingSummaryRes = await fetch("/api/feature-flags?summary=1&flag=onboarding_tutorial", { credentials: "include" });
      const onboardingSummaryData = await onboardingSummaryRes.json();
      if (onboardingSummaryRes.ok && onboardingSummaryData?.summary) {
        setOnboardingEnabledUsers(onboardingSummaryData.summary.enabledCount ?? null);
        setOnboardingGlobal(Boolean(onboardingSummaryData.summary.defaultEnabled));
      }
    } catch (err) {
      console.warn("[FeatureFlagsPage] Failed to load flag data", err);
    }
  };

  const updateFlag = async (flagName: string, scope: "user" | "global", enabled: boolean) => {
    setSaving(true);
    try {
      await fetch("/api/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ flag: flagName, enabled, scope }),
      });
      if (flagName === "line_numbers") {
        if (scope === "user") {
          setLineNumbersEnabled(enabled);
        } else {
          setLineNumbersGlobal(enabled);
        }
      } else if (flagName === "onboarding_tutorial") {
        if (scope === "user") {
          setOnboardingEnabled(enabled);
        } else {
          setOnboardingGlobal(enabled);
        }
      }
      // Refresh summary after change
      await loadFlags();
    } catch (err) {
      console.error("[FeatureFlagsPage] Failed to update flag", err);
    } finally {
      setSaving(false);
    }
  };

  const handleLineNumbersPersonalToggle = (checked: boolean) => updateFlag("line_numbers", "user", checked);
  const handleLineNumbersGlobalToggle = (checked: boolean) => updateFlag("line_numbers", "global", checked);
  const handleOnboardingPersonalToggle = (checked: boolean) => updateFlag("onboarding_tutorial", "user", checked);
  const handleOnboardingGlobalToggle = (checked: boolean) => updateFlag("onboarding_tutorial", "global", checked);

  if (isLoading || !user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Icon name="Loader" className="text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Line Numbers Feature Flag */}
      <div className="wewrite-card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold">Line numbers & dense mode</h2>
            <p className="text-sm text-muted-foreground">
              Enabled for: {enabledFraction} users
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">Admin only</Badge>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Enable for me</p>
              <p className="text-xs text-muted-foreground">Personal override</p>
            </div>
            <Switch checked={lineNumbersEnabled} onCheckedChange={handleLineNumbersPersonalToggle} disabled={saving} className="shrink-0" />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Enable for all users</p>
              <p className="text-xs text-muted-foreground">Sets global default</p>
            </div>
            <Switch checked={lineNumbersGlobal} onCheckedChange={handleLineNumbersGlobalToggle} disabled={saving} className="shrink-0" />
          </div>
        </div>
      </div>

      {/* Onboarding Tutorial Feature Flag */}
      <div className="wewrite-card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold">Onboarding Tutorial</h2>
            <p className="text-sm text-muted-foreground">
              Enabled for: {onboardingEnabledFraction} users
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">Admin only</Badge>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Enable for me</p>
              <p className="text-xs text-muted-foreground">Personal override</p>
            </div>
            <Switch checked={onboardingEnabled} onCheckedChange={handleOnboardingPersonalToggle} disabled={saving} className="shrink-0" />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Enable for all users</p>
              <p className="text-xs text-muted-foreground">New users see tutorial</p>
            </div>
            <Switch checked={onboardingGlobal} onCheckedChange={handleOnboardingGlobalToggle} disabled={saving} className="shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}
