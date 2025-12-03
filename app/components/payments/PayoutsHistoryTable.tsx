'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import {
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  FileText,
  Filter,
  ExternalLink
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { formatCurrency } from '../../utils/formatCurrency';

interface PayoutRecord {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'in_transit' | 'paid' | 'failed' | 'canceled'; // Exact Stripe statuses
  createdAt: string;
  completedAt?: string;
  estimatedArrival?: string;
  bankAccount?: {
    bankName: string;
    last4: string;
    accountType: string;
  };
  stripePayoutId?: string;
  failureReason?: string;
  description?: string;
  period?: string; // e.g., "2025-01" for monthly payouts
}

interface PayoutsHistoryTableProps {
  showTitle?: boolean;
  onRefresh?: () => void;
}

export function PayoutsHistoryTable({ showTitle = true, onRefresh }: PayoutsHistoryTableProps) {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  // Load payout history
  const loadPayoutHistory = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/payouts/history', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load payout history: ${response.statusText}`);
      }

      const data = await response.json();
      setPayouts(data.payouts || []);
    } catch (err) {
      console.error('Error loading payout history:', err);
      setError('Failed to load payout history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Download CSV
  const downloadCsv = async () => {
    if (!user?.uid) return;

    try {
      setDownloadingCsv(true);

      const response = await fetch('/api/payouts/history/csv', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download CSV: ${response.statusText}`);
      }

      // Get the CSV content
      const csvContent = await response.text();
      
      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `payouts-history-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading CSV:', err);
      setError('Failed to download CSV. Please try again.');
    } finally {
      setDownloadingCsv(false);
    }
  };

  useEffect(() => {
    loadPayoutHistory();
  }, [user?.uid]);

  // Filter payouts based on status
  const filteredPayouts = payouts.filter(payout => 
    statusFilter === 'all' || payout.status === statusFilter
  );

  // Get status badge
  const getStatusBadge = (status: PayoutRecord['status']) => {
    // Exact Stripe payout statuses with descriptions
    const statusConfig = {
      pending: {
        icon: Clock,
        color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
        label: 'Pending',
        description: 'Payout is pending until submitted to bank'
      },
      in_transit: {
        icon: Loader2,
        color: 'bg-muted/50 text-muted-foreground',
        label: 'In Transit',
        description: 'Payout has been submitted to bank and is in transit'
      },
      paid: {
        icon: CheckCircle,
        color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
        label: 'Paid',
        description: 'Payout completed successfully'
      },
      failed: {
        icon: XCircle,
        color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
        label: 'Failed',
        description: 'Payout failed to complete'
      },
      canceled: {
        icon: AlertTriangle,
        color: 'bg-muted text-muted-foreground',
        label: 'Canceled',
        description: 'Payout was canceled'
      }
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant="secondary" className={`${config.color} flex items-center gap-1`} title={config.description}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Calculate summary stats (convert from cents to dollars)
  const summaryStats = {
    totalPayouts: filteredPayouts.length,
    totalAmount: filteredPayouts.reduce((sum, payout) => sum + (payout.amount / 100), 0),
    completedPayouts: filteredPayouts.filter(p => p.status === 'paid').length,
    pendingPayouts: filteredPayouts.filter(p => p.status === 'pending' || p.status === 'in_transit').length
  };

  if (!user) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>
          Please log in to view your payout history.
        </AlertDescription>
      </Alert>
    );
  }

  const content = (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Card>
          <CardContent className="p-2 md:p-4">
            <div className="flex items-center gap-1 md:gap-2">
              <FileText className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-base md:text-2xl font-bold">{summaryStats.totalPayouts}</div>
                <div className="text-xs md:text-sm text-muted-foreground truncate">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-2 md:p-4">
            <div className="flex items-center gap-1 md:gap-2">
              <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-base md:text-2xl font-bold truncate">{formatCurrency(summaryStats.totalAmount)}</div>
                <div className="text-xs md:text-sm text-muted-foreground truncate">Amount</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-2 md:p-4">
            <div className="flex items-center gap-1 md:gap-2">
              <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-base md:text-2xl font-bold">{summaryStats.completedPayouts}</div>
                <div className="text-xs md:text-sm text-muted-foreground truncate">Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-2 md:p-4">
            <div className="flex items-center gap-1 md:gap-2">
              <Clock className="h-3 w-3 md:h-4 md:w-4 text-yellow-600 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-base md:text-2xl font-bold">{summaryStats.pendingPayouts}</div>
                <div className="text-xs md:text-sm text-muted-foreground truncate">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              loadPayoutHistory();
              onRefresh?.();
            }}
            disabled={loading}
            variant="secondary"
            size="sm"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Calendar className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>

          <Button
            onClick={downloadCsv}
            disabled={downloadingCsv || filteredPayouts.length === 0}
            variant="secondary"
            size="sm"
          >
            {downloadingCsv ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download CSV
          </Button>
        </div>
      </div>

      {/* Payouts Table/Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading payout history...</span>
        </div>
      ) : filteredPayouts.length === 0 ? (
        <Card className="border-theme-strong border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">No Payouts Found</h4>
            <p className="text-muted-foreground text-center">
              {statusFilter === 'all'
                ? "You haven't received any payouts yet. Start earning tokens to see your payout history here."
                : `No payouts found with status "${statusFilter}".`
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Bank Account</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Arrival</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {new Date(payout.createdAt).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(payout.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium">
                          {formatCurrency(payout.amount / 100, payout.currency)}
                        </div>
                        {payout.description && (
                          <div className="text-sm text-muted-foreground">
                            {payout.description}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {getStatusBadge(payout.status)}
                        {payout.failureReason && (
                          <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                            {payout.failureReason}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {payout.bankAccount ? (
                          <div>
                            <div className="font-medium">{payout.bankAccount.bankName}</div>
                            <div className="text-sm text-muted-foreground">
                              {payout.bankAccount.accountType} ••••{payout.bankAccount.last4}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {payout.period ? (
                          <Badge variant="secondary">
                            {payout.period}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {payout.estimatedArrival ? (
                          <div className="text-sm">
                            {new Date(payout.estimatedArrival).toLocaleDateString()}
                          </div>
                        ) : payout.completedAt ? (
                          <div className="text-sm text-green-600 dark:text-green-400">
                            Completed {new Date(payout.completedAt).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {filteredPayouts.map((payout) => (
              <Card key={payout.id} className="wewrite-card">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Header Row - Amount and Status */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold">
                          {formatCurrency(payout.amount / 100, payout.currency)}
                        </div>
                        {payout.description && (
                          <div className="text-sm text-muted-foreground">
                            {payout.description}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(payout.status)}
                        {payout.period && (
                          <Badge variant="secondary" className="text-xs">
                            {payout.period}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Date and Time */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(payout.createdAt).toLocaleDateString()} at{' '}
                        {new Date(payout.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    {/* Bank Account */}
                    {payout.bankAccount && (
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium">{payout.bankAccount.bankName}</span>
                          <span className="text-muted-foreground ml-2">
                            {payout.bankAccount.accountType} ••••{payout.bankAccount.last4}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Arrival/Completion Info */}
                    {(payout.estimatedArrival || payout.completedAt) && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {payout.estimatedArrival ? (
                          <span className="text-muted-foreground">
                            Expected: {new Date(payout.estimatedArrival).toLocaleDateString()}
                          </span>
                        ) : payout.completedAt ? (
                          <span className="text-green-600">
                            Completed: {new Date(payout.completedAt).toLocaleDateString()}
                          </span>
                        ) : null}
                      </div>
                    )}

                    {/* Failure Reason */}
                    {payout.failureReason && (
                      <div className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <span className="text-red-600 dark:text-red-400">{payout.failureReason}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );

  if (!showTitle) {
    return content;
  }

  return (
    <Card className="wewrite-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              Payout History
            </CardTitle>
            <CardDescription>
              View and download your complete payout history including status, amounts, and bank account details.
            </CardDescription>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              // Use location.href for PWA compatibility instead of window.open
              window.location.href = 'https://dashboard.stripe.com/connect/accounts';
            }}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">View payouts dashboard on Stripe</span>
            <span className="sm:hidden">Stripe Dashboard</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
