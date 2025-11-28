"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Separator } from "../../components/ui/separator";
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { AdminSubpageHeader } from "../../components/admin/AdminSubpageHeader";

type ApiResponse = { success?: boolean; message?: string; error?: string };

export default function FinancialTestsPage() {
  const [storageAmount, setStorageAmount] = useState("200");
  const [payoutAmount, setPayoutAmount] = useState("25");
  const [fee, setFee] = useState("0");
  const [payerUserId, setPayerUserId] = useState("");
  const [pageId, setPageId] = useState("");
  const [connectedAccountId, setConnectedAccountId] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [storageBalance, setStorageBalance] = useState<string | null>(null);
  const [paymentsBalance, setPaymentsBalance] = useState<string | null>(null);

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

  const ActionButton = ({ label, actionId, onClick }: { label: string; actionId: string; onClick: () => void }) => (
    <Button onClick={onClick} disabled={loadingAction !== null} className="w-full flex items-center justify-center gap-2">
      {loadingAction === actionId && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </Button>
  );

  const refreshStorageBalance = async () => {
    try {
      const res = await fetch('/api/admin/test-storage-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_current_balances' })
      });
      const data = await res.json();
      if (res.ok && data?.result?.balanceBreakdown) {
        const sb = data.result.balanceBreakdown.storageBalance?.toFixed?.(2) || '0.00';
        const pb = data.result.balanceBreakdown.paymentsBalance?.toFixed?.(2) || '0.00';
        setStorageBalance(`$${sb}`);
        setPaymentsBalance(`$${pb}`);
      } else {
        setStorageBalance('Unavailable');
        setPaymentsBalance('Unavailable');
      }
    } catch (err) {
      setStorageBalance('Unavailable');
      setPaymentsBalance('Unavailable');
    }
  };

  React.useEffect(() => {
    refreshStorageBalance();
  }, []);

  return (
    <div className="space-y-6 p-4 pt-4 max-w-4xl mx-auto">
      <AdminSubpageHeader
        title="Financial Tests"
        description="Simulate payments, storage transfers, and payouts in test mode."
      />

      <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-2 text-sm text-muted-foreground">
        Admin-only test harness. Runs in test mode only, never touches live balances. Look for “test=true” flags in stored records.
      </div>

      {status && (
        <Alert variant={status.type === "success" ? "default" : "destructive"}>
          {status.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <AlertDescription className="ml-2">{status.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Simulate earnings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Amount (USD)</Label>
              <Input value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} type="number" min="0" step="0.01" />
            </div>
            <div>
              <Label>Fee (USD)</Label>
              <Input value={fee} onChange={(e) => setFee(e.target.value)} type="number" min="0" step="0.01" />
            </div>
            <div>
              <Label>Test payer / user ID</Label>
              <Input value={payerUserId} onChange={(e) => setPayerUserId(e.target.value)} placeholder="optional" />
            </div>
            <div>
              <Label>Target page ID</Label>
              <Input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="optional" />
            </div>
            <div>
              <Label>Connected account override</Label>
              <Input value={connectedAccountId} onChange={(e) => setConnectedAccountId(e.target.value)} placeholder="acct_xxx (optional)" />
            </div>
            <div>
              <Label>Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional note" />
            </div>
          </div>
          <ActionButton
            label="Simulate earnings"
            actionId="/api/admin/financial-tests/earnings"
            onClick={() =>
              post("/api/admin/financial-tests/earnings", {
                amount: Number(payoutAmount),
                fee: Number(fee),
                payerUserId,
                pageId,
                connectedAccountId,
                note,
              })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage balance & payouts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground flex flex-wrap gap-3">
            <span>Payments balance: {paymentsBalance || 'Loading...'}</span>
            <span>Storage balance: {storageBalance || 'Loading...'}</span>
            <Button variant="ghost" size="sm" onClick={refreshStorageBalance} className="ml-auto">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Fund payments balance (USD)</Label>
              <Input value={storageAmount} onChange={(e) => setStorageAmount(e.target.value)} type="number" min="0" step="0.01" />
            </div>
            <div className="flex items-end">
              <ActionButton
                label="Fund payments"
                actionId="/api/admin/test-payments-fund"
                onClick={() =>
                  post('/api/admin/test-payments-fund', {
                    amount: Number(storageAmount),
                  }).then(refreshStorageBalance)
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Move payments → storage (USD)</Label>
              <Input value={storageAmount} onChange={(e) => setStorageAmount(e.target.value)} type="number" min="0" step="0.01" />
            </div>
            <div className="flex items-end">
              <ActionButton
                label="Add to storage"
                actionId="/api/admin/test-storage-balance"
                onClick={() =>
                  post('/api/admin/test-storage-balance', {
                    action: 'test_move_to_storage',
                    amount: Number(storageAmount),
                    confirm: true,
                  }).then(refreshStorageBalance)
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Payout total (USD)</Label>
              <Input value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} type="number" min="0" step="0.01" />
            </div>
            <div>
              <Label>Connected account</Label>
              <Input value={connectedAccountId} onChange={(e) => setConnectedAccountId(e.target.value)} placeholder="acct_xxx" />
            </div>
          </div>
          <ActionButton
            label="Simulate payout"
            actionId="/api/admin/financial-tests/payout"
            onClick={() =>
              post("/api/admin/financial-tests/payout", {
                amount: Number(payoutAmount),
                connectedAccountId,
                note,
              }).then(refreshStorageBalance)
            }
          />
          <Separator />
          <ActionButton
            label="Simulate payout failure"
            actionId="/api/admin/financial-tests/failure"
            onClick={() => post("/api/admin/financial-tests/failure", { failureCode: "simulated_failure", note })}
          />

          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            Storage balance: {storageBalance || 'Loading...'}
            <Button variant="ghost" size="sm" className="ml-2" onClick={refreshStorageBalance}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ActionButton label="Re-run last test payout (placeholder)" actionId="rerun-placeholder" onClick={() => setStatus({ type: "success", message: "Hook up to batch re-run when available." })} />
          <ActionButton label="Clear test ledger + batches" actionId="clear" onClick={clearTests} />
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
        <RefreshCw className="h-4 w-4" />
        Logs and detailed batch records can be queried from Firestore collections: adminFinancialTestLedger, adminFinancialTestPayoutBatches (test=true).
      </div>
    </div>
  );
}
