"use client";

import React, { useState } from "react";
import { Icon } from '@/components/ui/Icon';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AdminSubpageHeader } from "../../components/admin/AdminSubpageHeader";
import { PLATFORM_FEE_CONFIG } from "../../config/platformFee";

type ApiResponse = { success?: boolean; message?: string; error?: string };

export default function FinancialTestsPage() {
  // Test parameters
  const [fundAmount, setFundAmount] = useState("25");
  const [earningsAmount, setEarningsAmount] = useState("25");
  const [payoutAmount, setPayoutAmount] = useState("25");
  const [payerUserId, setPayerUserId] = useState("");
  const [pageId, setPageId] = useState("");
  const [connectedAccountId, setConnectedAccountId] = useState("");
  const [note, setNote] = useState("");

  // UI state
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [paymentsBalance, setPaymentsBalance] = useState<string | null>(null);

  // Calculated payout values using platform fee config
  const grossPayout = Number(payoutAmount) || 0;
  const payoutFee = grossPayout * PLATFORM_FEE_CONFIG.PERCENTAGE;
  const netPayout = grossPayout - payoutFee;

  // Referral split of the payout fee
  const referrerShare = payoutFee * PLATFORM_FEE_CONFIG.REFERRAL_SHARE;
  const wewriteShare = payoutFee * PLATFORM_FEE_CONFIG.WEWRITE_SHARE;

  const post = async (url: string, body?: Record<string, any>) => {
    setStatus(null);
    setLoadingAction(url);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      if (!res.ok || data.error) {
        const detail = data.details || data.stack || data.error || text || "Request failed";
        throw new Error(detail);
      }
      const extra = data.batchId || data.id ? ` (id: ${data.batchId || data.id})` : "";
      setStatus({ type: "success", message: `${data.message || "Done"}${extra}` });
    } catch (err: any) {
      setStatus({ type: "error", message: err.message || "Request failed" });
    } finally {
      setLoadingAction(null);
    }
  };

  const clearTests = async () => {
    setStatus(null);
    setLoadingAction("clear");
    try {
      const res = await fetch("/api/admin/financial-tests", { method: "DELETE" });
      const data: ApiResponse = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Cleanup failed");
      setStatus({ type: "success", message: data.message || "Cleared" });
    } catch (err: any) {
      setStatus({ type: "error", message: err.message || "Cleanup failed" });
    } finally {
      setLoadingAction(null);
    }
  };

  const ActionButton = ({ label, actionId, onClick, variant = "default" }: {
    label: string;
    actionId: string;
    onClick: () => void;
    variant?: "default" | "outline" | "destructive";
  }) => (
    <Button
      onClick={onClick}
      disabled={loadingAction !== null}
      variant={variant}
      className="w-full flex items-center justify-center gap-2"
    >
      {loadingAction === actionId && <Icon name="Loader" />}
      {label}
    </Button>
  );

  const refreshBalance = async () => {
    try {
      const res = await fetch('/api/admin/test-storage-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_current_balances' })
      });
      const data = await res.json();
      if (res.ok && data?.balances?.paymentsBalance) {
        setPaymentsBalance(data.balances.paymentsBalance);
      } else {
        setPaymentsBalance('Unavailable');
      }
    } catch (err) {
      setPaymentsBalance('Unavailable');
    }
  };

  React.useEffect(() => {
    refreshBalance();
  }, []);

  return (
    <div className="space-y-6 p-4 pt-4 max-w-4xl mx-auto">
      <AdminSubpageHeader
        title="Financial Tests"
        description="Test the payments flow in Stripe test mode. All operations are flagged with test=true."
      />

      {/* Current Balance Display */}
      <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon name="DollarSign" size={20} className="text-muted-foreground" />
          <div>
            <div className="text-sm text-muted-foreground">Stripe Payments Balance</div>
            <div className="text-lg font-semibold">{paymentsBalance || 'Loading...'}</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={refreshBalance}>
          <Icon name="RefreshCw" size={16} />
        </Button>
      </div>

      {status && (
        <Alert variant={status.type === "success" ? "default" : "destructive"}>
          {status.type === "success" ? <Icon name="CheckCircle2" size={16} /> : <Icon name="AlertTriangle" size={16} />}
          <AlertDescription className="ml-2">{status.message}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: Fund Payments Balance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-bold">1</span>
            Fund Payments Balance
          </CardTitle>
          <CardDescription>
            Simulate a subscription payment by adding funds to Stripe Payments Balance using a test card.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Amount to fund (USD)</Label>
              <Input
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                type="number"
                min="1"
                step="1"
                placeholder="25"
              />
            </div>
            <div className="flex items-end">
              <ActionButton
                label="Fund via Test Card"
                actionId="/api/admin/test-payments-fund"
                onClick={() =>
                  post('/api/admin/test-payments-fund', {
                    amount: Number(fundAmount),
                  }).then(refreshBalance)
                }
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Uses Stripe test card (pm_card_visa) to create a PaymentIntent and fund your account.
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Simulate Earnings (Allocation) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-bold">2</span>
            Simulate Writer Earnings
          </CardTitle>
          <CardDescription>
            Create a test ledger entry simulating a reader allocating funds to a writer's page.
            No fee is charged at allocation time - writers receive the full amount.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Allocation amount (USD)</Label>
              <Input
                value={earningsAmount}
                onChange={(e) => setEarningsAmount(e.target.value)}
                type="number"
                min="0.01"
                step="0.01"
              />
            </div>
            <div className="flex items-end">
              <div className="text-sm text-muted-foreground p-2 border rounded bg-muted/30 w-full text-center">
                Writer earns: <span className="font-semibold text-green-600">${Number(earningsAmount).toFixed(2)}</span>
                <div className="text-xs">(no fee at allocation)</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Payer user ID (optional)</Label>
              <Input value={payerUserId} onChange={(e) => setPayerUserId(e.target.value)} placeholder="test_user_123" />
            </div>
            <div>
              <Label>Target page ID (optional)</Label>
              <Input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="page_abc" />
            </div>
          </div>

          <ActionButton
            label="Simulate Earnings"
            actionId="/api/admin/financial-tests/earnings"
            onClick={() =>
              post("/api/admin/financial-tests/earnings", {
                amount: Number(earningsAmount),
                fee: 0, // No fee at allocation time
                payerUserId: payerUserId || undefined,
                pageId: pageId || undefined,
                connectedAccountId: connectedAccountId || undefined,
                note: note || undefined,
              })
            }
          />
        </CardContent>
      </Card>

      {/* Step 3: Simulate Payout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-bold">3</span>
            Simulate Writer Payout
          </CardTitle>
          <CardDescription>
            Test the payout flow - transferring earnings from Stripe to a writer's connected account.
            The {PLATFORM_FEE_CONFIG.PERCENTAGE_DISPLAY}% payout fee is applied at this stage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Gross payout amount (USD)</Label>
              <Input
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                type="number"
                min="0.01"
                step="0.01"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Icon name="Percent" size={12} />
                Payout Fee ({PLATFORM_FEE_CONFIG.PERCENTAGE_DISPLAY}%)
              </Label>
              <Input
                value={`$${payoutFee.toFixed(2)}`}
                disabled
                className="bg-muted"
              />
            </div>
          </div>

          {/* Payout breakdown visualization */}
          <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Gross: ${grossPayout.toFixed(2)}</span>
              <Icon name="ArrowRight" size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">- {PLATFORM_FEE_CONFIG.PERCENTAGE_DISPLAY}% fee (${payoutFee.toFixed(2)})</span>
              <Icon name="ArrowRight" size={16} className="text-muted-foreground" />
              <span className="font-semibold text-green-600">Writer receives: ${netPayout.toFixed(2)}</span>
            </div>

            {/* Referral split breakdown */}
            <div className="pt-2 border-t border-border/40">
              <div className="text-xs text-muted-foreground mb-1">If writer was referred, the ${payoutFee.toFixed(2)} fee splits:</div>
              <div className="flex items-center gap-4 text-xs">
                <span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  {PLATFORM_FEE_CONFIG.WEWRITE_SHARE_DISPLAY}% WeWrite: ${wewriteShare.toFixed(2)}
                </span>
                <span className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  {PLATFORM_FEE_CONFIG.REFERRAL_SHARE_DISPLAY}% Referrer: ${referrerShare.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Connected account ID</Label>
              <Input
                value={connectedAccountId}
                onChange={(e) => setConnectedAccountId(e.target.value)}
                placeholder="acct_xxx (required for real transfer)"
              />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Test payout note" />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <ActionButton
                label="Simulate Payout"
                actionId="/api/admin/financial-tests/payout"
                onClick={() =>
                  post("/api/admin/financial-tests/payout", {
                    amount: grossPayout,
                    connectedAccountId: connectedAccountId || undefined,
                    note: note || undefined,
                  }).then(refreshBalance)
                }
              />
            </div>
            <div className="flex-1">
              <ActionButton
                label="Simulate Payout Failure"
                actionId="/api/admin/financial-tests/failure"
                variant="outline"
                onClick={() => post("/api/admin/financial-tests/failure", { failureCode: "simulated_failure", note })}
              />
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Without a connected account, creates a test batch record only. With a connected account, attempts a real Stripe test transfer.
          </div>
        </CardContent>
      </Card>

      {/* Platform Fee Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Fee Structure</CardTitle>
          <CardDescription>
            Defined in <code className="text-xs bg-muted px-1 py-0.5 rounded">app/config/platformFee.ts</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border border-border/40 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Payout Fee</div>
                <div className="text-2xl font-bold">{PLATFORM_FEE_CONFIG.PERCENTAGE_DISPLAY}%</div>
              </div>
              <div className="text-xs text-muted-foreground">
                Charged when writers withdraw earnings to their bank account.
              </div>

              <div className="mt-3 pt-3 border-t border-border/40">
                <div className="text-xs font-medium mb-2">Referral Split (if writer was referred):</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/50">
                    <div className="font-medium">{PLATFORM_FEE_CONFIG.WEWRITE_SHARE_DISPLAY}% to WeWrite</div>
                    <div className="text-muted-foreground">({PLATFORM_FEE_CONFIG.WEWRITE_SHARE * PLATFORM_FEE_CONFIG.PERCENTAGE * 100}% of payout)</div>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <div className="font-medium">{PLATFORM_FEE_CONFIG.REFERRAL_SHARE_DISPLAY}% to Referrer</div>
                    <div className="text-muted-foreground">({PLATFORM_FEE_CONFIG.REFERRAL_SHARE * PLATFORM_FEE_CONFIG.PERCENTAGE * 100}% of payout)</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Minimum payout: ${PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_DOLLARS}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ActionButton
            label="Clear test ledger & batches"
            actionId="clear"
            onClick={clearTests}
            variant="destructive"
          />
          <div className="text-xs text-muted-foreground">
            Clears records from: adminFinancialTestLedger, adminFinancialTestPayoutBatches (test=true only).
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
