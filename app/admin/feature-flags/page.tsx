"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";
import { isAdmin } from "../../utils/isAdmin";
import { FloatingHeader } from "../../components/ui/FloatingCard";
import { Card } from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import { Badge } from "../../components/ui/badge";
import { Loader, ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button";

export default function FeatureFlagsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [lineNumbersEnabled, setLineNumbersEnabled] = useState(false);
  const [lineNumbersGlobal, setLineNumbersGlobal] = useState(false);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [enabledUsers, setEnabledUsers] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const enabledFraction =
    totalUsers && totalUsers > 0
      ? `${enabledUsers ?? 0}/${totalUsers}`
      : "—";

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/auth/login?redirect=/admin/feature-flags");
        return;
      }
      if (!isAdmin(user.email)) {
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
      }
      const summaryRes = await fetch("/api/feature-flags?summary=1", { credentials: "include" });
      const summaryData = await summaryRes.json();
      if (summaryRes.ok && summaryData?.summary) {
        setTotalUsers(summaryData.summary.totalUsers ?? null);
        setEnabledUsers(summaryData.summary.enabledCount ?? null);
        setLineNumbersGlobal(Boolean(summaryData.summary.defaultEnabled));
      }
    } catch (err) {
      console.warn("[FeatureFlagsPage] Failed to load flag data", err);
    }
  };

  const updateFlag = async (scope: "user" | "global", enabled: boolean) => {
    setSaving(true);
    try {
      await fetch("/api/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ flag: "line_numbers", enabled, scope }),
      });
      if (scope === "user") {
        setLineNumbersEnabled(enabled);
      } else {
        setLineNumbersGlobal(enabled);
      }
      // Refresh summary after change
      await loadFlags();
    } catch (err) {
      console.error("[FeatureFlagsPage] Failed to update flag", err);
    } finally {
      setSaving(false);
    }
  };

  const handlePersonalToggle = (checked: boolean) => updateFlag("user", checked);
  const handleGlobalToggle = (checked: boolean) => updateFlag("global", checked);

  if (isLoading || !user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAdmin(user.email)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-4xl">
        <FloatingHeader className="fixed-header-sidebar-aware px-4 py-3 mb-6 flex items-center justify-between lg:relative lg:top-0 lg:left-0 lg:right-0 lg:z-auto lg:mb-6 lg:px-0 lg:py-2">
          <div>
            <h1 className="text-3xl font-bold leading-tight">Feature Flags</h1>
            <p className="text-muted-foreground">Admin-only preview controls</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
        </FloatingHeader>

        <div className="pt-24 lg:pt-0 space-y-4">
          <Card className="p-4">
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
          </Card>

          <Card className="p-4 space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Enable for me</h3>
                  <p className="text-sm text-muted-foreground">
                    Personal override for the current admin account.
                  </p>
                </div>
                <Switch checked={lineNumbersEnabled} onCheckedChange={handlePersonalToggle} disabled={saving} />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Enable for all users</h3>
                  <p className="text-sm text-muted-foreground">
                    Sets the global default. Users can still be opted out via overrides.
                  </p>
                </div>
                <Switch checked={lineNumbersGlobal} onCheckedChange={handleGlobalToggle} disabled={saving} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
