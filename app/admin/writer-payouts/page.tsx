"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Icon } from '@/components/ui/Icon';
import { AdminSubpageHeader } from "../../components/admin/AdminSubpageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { SortableTableHeader, type SortDirection } from "../../components/ui/sortable-table-header";
import { useAdminData } from "../../providers/AdminDataProvider";
import { PLATFORM_FEE_CONFIG } from "../../config/platformFee";

type WriterRow = {
  userId: string;
  username: string;
  totalEarnedCents: number;
  unfundedAllocationsCents: number;
  availableCents: number;
  paidOutCents: number;
  lastMonth: string;
  allocationRawCents: number;
  allocationFundedCents: number;
  allocationEntries: number;
  recordsMissingAllocationDetails: number;
};

type PayoutRow = {
  id: string;
  userId: string;
  amountCents: number;
  status: string;
  requestedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
};

type StatusPayload = {
  generatedAt: string;
  totals: {
    writers: number;
    writersReturned: number;
    earningsRecords: number;
    payouts: number;
    payoutsReturned: number;
  };
  earningsStatusCounts: Record<string, number>;
  earningsStatusAmountsCents: Record<string, number>;
  payoutStatusCounts: Record<string, number>;
  payoutStatusAmountsCents: Record<string, number>;
  allocationAudit: {
    rawCents: number;
    fundedCents: number;
    deltaCents: number;
    earningsWithAllocationDetails: number;
    earningsMissingAllocationDetails: number;
  };
  writers: WriterRow[];
  payouts: PayoutRow[];
};

type WriterSortKey =
  | "username"
  | "unfundedAllocationsCents"
  | "availableCents"
  | "gapToThreshold"
  | "paidOutCents"
  | "totalEarnedCents"
  | "lastMonth";
type PayoutSortKey = "id" | "userId" | "amountCents" | "status" | "requestedAt" | "completedAt" | "failureReason";

const toSafeCents = (value: unknown) => {
  const cents = Number(value);
  return Number.isFinite(cents) ? cents : 0;
};

const dollars = (cents: unknown) => `$${(toSafeCents(cents) / 100).toFixed(2)}`;
const payoutThresholdCents = PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_CENTS;
const payoutThresholdDollars = PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_DOLLARS;

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  if (normalized === "completed") return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
  if (normalized === "pending") return <Badge className="bg-amber-100 text-amber-800">Pending</Badge>;
  if (normalized === "pending_approval") return <Badge className="bg-blue-100 text-blue-800">Pending Approval</Badge>;
  if (normalized === "failed") return <Badge className="bg-red-100 text-red-800">Failed</Badge>;

  return <Badge variant="secondary">{status}</Badge>;
}

export default function WriterPayoutsPage() {
  const { adminFetch, isHydrated, dataSource } = useAdminData();
  const [limit, setLimit] = useState("100");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatusPayload | null>(null);
  const [writerSort, setWriterSort] = useState<{ key: WriterSortKey; direction: SortDirection }>({
    key: "totalEarnedCents",
    direction: "desc",
  });
  const [payoutSort, setPayoutSort] = useState<{ key: PayoutSortKey; direction: SortDirection }>({
    key: "requestedAt",
    direction: "desc",
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: String(Math.max(1, Number(limit) || 100)) });
      const response = await adminFetch(`/api/admin/writer-payouts/status?${params.toString()}`, {
        credentials: 'include',
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Failed to load writer payouts status");
      }
      setData(json.data as StatusPayload);
    } catch (err: any) {
      setError(err.message || "Failed to load writer payouts status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isHydrated) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, dataSource]);

  const topSummary = useMemo(() => {
    if (!data) {
      return {
        totalAvailable: 0,
        totalUnfundedAllocations: 0,
        totalPaidOut: 0,
        totalCompletedPayouts: 0,
      };
    }

    return {
      totalAvailable: data.earningsStatusAmountsCents.available || 0,
      totalUnfundedAllocations: (data.writers || []).reduce(
        (sum, writer) => sum + toSafeCents(writer.unfundedAllocationsCents),
        0
      ),
      totalPaidOut: data.earningsStatusAmountsCents.paid_out || 0,
      totalCompletedPayouts: data.payoutStatusAmountsCents.completed || 0,
    };
  }, [data]);

  const handleWriterSort = (key: WriterSortKey) => {
    setWriterSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handlePayoutSort = (key: PayoutSortKey) => {
    setPayoutSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortedWriters = useMemo(() => {
    const rows = [...(data?.writers || [])];
    const multiplier = writerSort.direction === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      const aGap = Math.max(0, payoutThresholdCents - a.availableCents);
      const bGap = Math.max(0, payoutThresholdCents - b.availableCents);

      const valueMapA: Record<WriterSortKey, string | number> = {
        username: (a.username || "").toLowerCase(),
        unfundedAllocationsCents: a.unfundedAllocationsCents,
        availableCents: a.availableCents,
        gapToThreshold: aGap,
        paidOutCents: a.paidOutCents,
        totalEarnedCents: a.totalEarnedCents,
        lastMonth: a.lastMonth || "",
      };

      const valueMapB: Record<WriterSortKey, string | number> = {
        username: (b.username || "").toLowerCase(),
        unfundedAllocationsCents: b.unfundedAllocationsCents,
        availableCents: b.availableCents,
        gapToThreshold: bGap,
        paidOutCents: b.paidOutCents,
        totalEarnedCents: b.totalEarnedCents,
        lastMonth: b.lastMonth || "",
      };

      const va = valueMapA[writerSort.key];
      const vb = valueMapB[writerSort.key];

      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * multiplier;
      }

      return String(va).localeCompare(String(vb)) * multiplier;
    });

    return rows;
  }, [data?.writers, writerSort]);

  const sortedPayouts = useMemo(() => {
    const rows = [...(data?.payouts || [])];
    const multiplier = payoutSort.direction === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      const valueMapA: Record<PayoutSortKey, string | number> = {
        id: a.id,
        userId: a.userId,
        amountCents: a.amountCents,
        status: a.status,
        requestedAt: a.requestedAt ? new Date(a.requestedAt).getTime() : 0,
        completedAt: a.completedAt ? new Date(a.completedAt).getTime() : 0,
        failureReason: a.failureReason || "",
      };

      const valueMapB: Record<PayoutSortKey, string | number> = {
        id: b.id,
        userId: b.userId,
        amountCents: b.amountCents,
        status: b.status,
        requestedAt: b.requestedAt ? new Date(b.requestedAt).getTime() : 0,
        completedAt: b.completedAt ? new Date(b.completedAt).getTime() : 0,
        failureReason: b.failureReason || "",
      };

      const va = valueMapA[payoutSort.key];
      const vb = valueMapB[payoutSort.key];

      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * multiplier;
      }

      return String(va).localeCompare(String(vb)) * multiplier;
    });

    return rows;
  }, [data?.payouts, payoutSort]);

  const fundingAuditRows = useMemo(() => {
    return [...(data?.writers || [])]
      .map((writer) => {
        const deltaCents = writer.allocationRawCents - writer.allocationFundedCents;
        const fundedPct = writer.allocationRawCents > 0
          ? (writer.allocationFundedCents / writer.allocationRawCents) * 100
          : null;
        return { writer, deltaCents, fundedPct };
      })
      .sort((a, b) => b.deltaCents - a.deltaCents);
  }, [data?.writers]);

  return (
    <div className="space-y-6 p-4 pt-4">
      <AdminSubpageHeader
        title="Writer Payouts"
        description="QA dashboard for writer earnings and payout statuses across the platform."
      />

      <Card>
        <CardContent className="pt-6 flex flex-col md:flex-row md:items-end gap-3">
          <Button onClick={fetchData} disabled={loading} className="gap-2">
            {loading ? <Icon name="Loader" /> : <Icon name="RefreshCw" size={16} />}
            Refresh
          </Button>
          {data?.generatedAt && (
            <div className="text-xs text-muted-foreground md:ml-auto">
              Updated {new Date(data.generatedAt).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="pt-6 text-red-600">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>Available Earnings</CardDescription>
            <CardTitle>{dollars(topSummary.totalAvailable)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Unfunded Allocations</CardDescription>
            <CardTitle>{dollars(topSummary.totalUnfundedAllocations)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Paid Out Earnings</CardDescription>
            <CardTitle>{dollars(topSummary.totalPaidOut)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Completed Payouts</CardDescription>
            <CardTitle>{dollars(topSummary.totalCompletedPayouts)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Writer Earnings Status</CardTitle>
          <CardDescription>
            Aggregated from `writerUsdEarnings` by writer. Showing {data?.totals.writersReturned ?? 0} of {data?.totals.writers ?? 0} writers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="text-left">
                  <TableHead className="py-2 pr-3">
                    <SortableTableHeader
                      label="Writer"
                      isActive={writerSort.key === "username"}
                      direction={writerSort.direction}
                      onClick={() => handleWriterSort("username")}
                    />
                  </TableHead>
                  <TableHead className="py-2 pr-3">
                    <SortableTableHeader
                      label="Unfunded Allocations"
                      isActive={writerSort.key === "unfundedAllocationsCents"}
                      direction={writerSort.direction}
                      onClick={() => handleWriterSort("unfundedAllocationsCents")}
                    />
                  </TableHead>
                  <TableHead className="py-2 pr-3">
                    <SortableTableHeader
                      label="Available"
                      isActive={writerSort.key === "availableCents"}
                      direction={writerSort.direction}
                      onClick={() => handleWriterSort("availableCents")}
                    />
                  </TableHead>
                  <TableHead className="py-2 pr-3">
                    <SortableTableHeader
                      label={`Until $${payoutThresholdDollars} Payout`}
                      isActive={writerSort.key === "gapToThreshold"}
                      direction={writerSort.direction}
                      onClick={() => handleWriterSort("gapToThreshold")}
                    />
                  </TableHead>
                  <TableHead className="py-2 pr-3">
                    <SortableTableHeader
                      label="Paid Out"
                      isActive={writerSort.key === "paidOutCents"}
                      direction={writerSort.direction}
                      onClick={() => handleWriterSort("paidOutCents")}
                    />
                  </TableHead>
                  <TableHead className="py-2 pr-3">
                    <SortableTableHeader
                      label="Total"
                      isActive={writerSort.key === "totalEarnedCents"}
                      direction={writerSort.direction}
                      onClick={() => handleWriterSort("totalEarnedCents")}
                    />
                  </TableHead>
                  <TableHead className="py-2">
                    <SortableTableHeader
                      label="Latest Month"
                      isActive={writerSort.key === "lastMonth"}
                      direction={writerSort.direction}
                      onClick={() => handleWriterSort("lastMonth")}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody striped>
                {sortedWriters.map((writer) => {
                  const gapToThresholdCents = Math.max(0, payoutThresholdCents - writer.availableCents);

                  return (
                    <TableRow key={writer.userId}>
                      <TableCell className="py-2 pr-3 font-medium">@{writer.username || "unknown"}</TableCell>
                      <TableCell kind="currency" className="py-2 pr-3">{dollars(writer.unfundedAllocationsCents)}</TableCell>
                      <TableCell kind="currency" className="py-2 pr-3">{dollars(writer.availableCents)}</TableCell>
                      <TableCell kind="currency" className="py-2 pr-3">
                        {gapToThresholdCents === 0 ? (
                          <Badge className="bg-green-100 text-green-800">Eligible</Badge>
                        ) : (
                          dollars(gapToThresholdCents)
                        )}
                      </TableCell>
                      <TableCell kind="currency" className="py-2 pr-3">{dollars(writer.paidOutCents)}</TableCell>
                      <TableCell kind="currency" className="py-2 pr-3 font-semibold">{dollars(writer.totalEarnedCents)}</TableCell>
                      <TableCell className="py-2">{writer.lastMonth || "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex justify-end">
            <div className="space-y-2 w-full md:w-64">
              <Label htmlFor="limit">Rows to load</Label>
              <Input
                id="limit"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                type="number"
                min="1"
                max="500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Payout Requests</CardTitle>
          <CardDescription>
            Latest payout records from `usdPayouts`. Showing {data?.totals.payoutsReturned ?? 0} of {data?.totals.payouts ?? 0} payouts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="text-left">
                  <TableHead className="py-2 pr-3">
                    <SortableTableHeader
                      label="Payout ID"
                      isActive={payoutSort.key === "id"}
                      direction={payoutSort.direction}
                      onClick={() => handlePayoutSort("id")}
                    />
                  </TableHead>
                  <TableHead className="py-2 pr-3">
                    <SortableTableHeader
                      label="Amount"
                      isActive={payoutSort.key === "amountCents"}
                      direction={payoutSort.direction}
                      onClick={() => handlePayoutSort("amountCents")}
                    />
                  </TableHead>
                  <TableHead className="py-2 pr-3">
                    <SortableTableHeader
                      label="Status"
                      isActive={payoutSort.key === "status"}
                      direction={payoutSort.direction}
                      onClick={() => handlePayoutSort("status")}
                    />
                  </TableHead>
                  <TableHead className="py-2 pr-3">
                    <SortableTableHeader
                      label="Requested"
                      isActive={payoutSort.key === "requestedAt"}
                      direction={payoutSort.direction}
                      onClick={() => handlePayoutSort("requestedAt")}
                    />
                  </TableHead>
                  <TableHead className="py-2 pr-3">
                    <SortableTableHeader
                      label="Completed"
                      isActive={payoutSort.key === "completedAt"}
                      direction={payoutSort.direction}
                      onClick={() => handlePayoutSort("completedAt")}
                    />
                  </TableHead>
                  <TableHead className="py-2">
                    <SortableTableHeader
                      label="Failure Reason"
                      isActive={payoutSort.key === "failureReason"}
                      direction={payoutSort.direction}
                      onClick={() => handlePayoutSort("failureReason")}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody striped>
                {sortedPayouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="py-2 pr-3 font-mono text-xs">{payout.id}</TableCell>
                    <TableCell kind="currency" className="py-2 pr-3">{dollars(payout.amountCents)}</TableCell>
                    <TableCell className="py-2 pr-3"><StatusBadge status={payout.status} /></TableCell>
                    <TableCell className="py-2 pr-3">{payout.requestedAt ? new Date(payout.requestedAt).toLocaleString() : "-"}</TableCell>
                    <TableCell className="py-2 pr-3">{payout.completedAt ? new Date(payout.completedAt).toLocaleString() : "-"}</TableCell>
                    <TableCell className="py-2 text-red-600">{payout.failureReason || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allocation Funding Reconciliation</CardTitle>
          <CardDescription>
            Audits raw allocated amounts vs funded allocated amounts captured in allocation-level entries.
            Coverage: {data?.allocationAudit?.earningsWithAllocationDetails ?? 0} earnings records with details, {data?.allocationAudit?.earningsMissingAllocationDetails ?? 0} without details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/50 p-3">
              <div className="text-xs text-muted-foreground">Raw Allocated (Detailed Records)</div>
              <div className="text-lg font-semibold">{dollars(data?.allocationAudit?.rawCents || 0)}</div>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <div className="text-xs text-muted-foreground">Funded Allocated (Detailed Records)</div>
              <div className="text-lg font-semibold">{dollars(data?.allocationAudit?.fundedCents || 0)}</div>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <div className="text-xs text-muted-foreground">Funding Delta</div>
              <div className="text-lg font-semibold text-amber-600">{dollars(data?.allocationAudit?.deltaCents || 0)}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="text-left">
                  <TableHead>Writer</TableHead>
                  <TableHead>Raw Allocated</TableHead>
                  <TableHead>Funded Allocated</TableHead>
                  <TableHead>Funding Delta</TableHead>
                  <TableHead>Funded %</TableHead>
                  <TableHead>Detail Coverage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fundingAuditRows.map(({ writer, deltaCents, fundedPct }) => (
                  <TableRow key={`audit_${writer.userId}`}>
                    <TableCell className="font-medium">@{writer.username || 'unknown'}</TableCell>
                    <TableCell kind="currency">{dollars(writer.allocationRawCents)}</TableCell>
                    <TableCell kind="currency">{dollars(writer.allocationFundedCents)}</TableCell>
                    <TableCell kind="currency" className={deltaCents > 0 ? 'text-amber-600 font-medium' : ''}>
                      {dollars(deltaCents)}
                    </TableCell>
                    <TableCell kind="number">{fundedPct === null ? '-' : `${fundedPct.toFixed(1)}%`}</TableCell>
                    <TableCell>
                      <span className="text-muted-foreground text-xs">
                        {writer.allocationEntries} entries, {writer.recordsMissingAllocationDetails} records missing
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
