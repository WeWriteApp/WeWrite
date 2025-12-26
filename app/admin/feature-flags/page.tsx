"use client";

import { useEffect, useState } from "react";
import { Icon } from '@/components/ui/Icon';
import { useRouter } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";
import { isAdmin } from "../../utils/isAdmin";
import { FloatingHeader } from "../../components/ui/FloatingCard";
import { Card } from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
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
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-4xl">
        {/* Desktop Header - hidden on mobile (drawer handles navigation) */}
        <div className="hidden lg:flex mb-6 items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold leading-tight">Feature Flags</h1>
            <p className="text-muted-foreground">Admin-only preview controls</p>
          </div>
        </div>

        <div className="pt-24 lg:pt-0 space-y-6">
          {/* Line Numbers Feature Flag */}
          <Card className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-semibold">Line numbers &amp; dense mode</h2>
                <p className="text-sm text-muted-foreground">
                  Control the line number feature flag. Disable by default for everyone.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enabled for: {enabledFraction} users
                </p>
              </div>
              <Badge variant="outline">Admin only</Badge>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Enable for me</h3>
                  <p className="text-sm text-muted-foreground">
                    Personal override for the current admin account.
                  </p>
                </div>
                <Switch checked={lineNumbersEnabled} onCheckedChange={handleLineNumbersPersonalToggle} disabled={saving} />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Enable for all users</h3>
                  <p className="text-sm text-muted-foreground">
                    Sets the global default. Users can still be opted out via overrides.
                  </p>
                </div>
                <Switch checked={lineNumbersGlobal} onCheckedChange={handleLineNumbersGlobalToggle} disabled={saving} />
              </div>
            </div>
          </Card>

          {/* Onboarding Tutorial Feature Flag */}
          <Card className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-semibold">Onboarding Tutorial</h2>
                <p className="text-sm text-muted-foreground">
                  Interactive guided tutorial for new users. Shows tooltips and highlights UI elements.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enabled for: {onboardingEnabledFraction} users
                </p>
              </div>
              <Badge variant="outline">Admin only</Badge>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Enable for me</h3>
                  <p className="text-sm text-muted-foreground">
                    Personal override for the current admin account.
                  </p>
                </div>
                <Switch checked={onboardingEnabled} onCheckedChange={handleOnboardingPersonalToggle} disabled={saving} />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Enable for all users</h3>
                  <p className="text-sm text-muted-foreground">
                    When enabled, new users will see the onboarding tutorial on first login.
                  </p>
                </div>
                <Switch checked={onboardingGlobal} onCheckedChange={handleOnboardingGlobalToggle} disabled={saving} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
