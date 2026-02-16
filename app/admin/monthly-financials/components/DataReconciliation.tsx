import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../../components/ui/button';
import { formatUsdCents } from '../../../utils/formatCurrency';
import type { ReconciliationData } from '../types';

interface DataReconciliationProps {
  reconciliation: ReconciliationData;
  isSyncing: boolean;
  onSync: () => void;
}

export function DataReconciliation({ reconciliation, isSyncing, onSync }: DataReconciliationProps) {
  return (
    <div className="wewrite-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {reconciliation.isInSync ? (
            <Icon name="CheckCircle" size={20} />
          ) : (
            <Icon name="AlertTriangle" size={20} />
          )}
          <h2 className="text-xl font-bold">Data Reconciliation</h2>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${reconciliation.isInSync
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-muted'}`}>
            {reconciliation.isInSync ? 'In Sync' : `${reconciliation.discrepancies?.length || 0} Discrepancies`}
          </span>
        </div>
        {!reconciliation.isInSync && reconciliation.discrepancies?.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <Icon name="Loader" />
                Syncing...
              </>
            ) : (
              <>
                <Icon name="RefreshCw" size={16} className="mr-2" />
                Sync with Stripe
              </>
            )}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Stripe Subscriptions</p>
          <p className="text-xl font-bold">{formatUsdCents(reconciliation.stripeSubscriptionsCents)}</p>
          <p className="text-xs text-muted-foreground">{reconciliation.stripeSubscriberCount} subscribers</p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Firebase Recorded</p>
          <p className="text-xl font-bold">{formatUsdCents(reconciliation.firebaseRecordedCents)}</p>
          <p className="text-xs text-muted-foreground">{reconciliation.firebaseUserCount} users</p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Discrepancy</p>
          <p className="text-xl font-bold">
            {reconciliation.discrepancyCents >= 0 ? '+' : ''}{formatUsdCents(reconciliation.discrepancyCents)}
          </p>
          <p className="text-xs text-muted-foreground">
            {reconciliation.userCountDiscrepancy >= 0 ? '+' : ''}{reconciliation.userCountDiscrepancy} users
          </p>
        </div>
      </div>

      {/* Sync Results */}
      {reconciliation.syncResults && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">Sync Completed</p>
          <ul className="text-xs text-green-700 dark:text-green-300 mt-1 space-y-0.5">
            {reconciliation.syncResults.staleRecordsFixed > 0 && (
              <li>Fixed {reconciliation.syncResults.staleRecordsFixed} stale records (cancelled subscriptions)</li>
            )}
            {reconciliation.syncResults.amountMismatchesFixed > 0 && (
              <li>Fixed {reconciliation.syncResults.amountMismatchesFixed} amount mismatches</li>
            )}
            {reconciliation.syncResults.errors.length > 0 && (
              <li className="text-red-600 dark:text-red-400">{reconciliation.syncResults.errors.length} errors occurred</li>
            )}
          </ul>
        </div>
      )}

      {/* Discrepancy Details */}
      {!reconciliation.isInSync && reconciliation.discrepancies?.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Discrepancy Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-left py-2 px-2">Email</th>
                  <th className="text-right py-2 px-2">Stripe Amount</th>
                  <th className="text-right py-2 px-2">Firebase Amount</th>
                  <th className="text-right py-2 px-2">Difference</th>
                </tr>
              </thead>
              <tbody>
                {reconciliation.discrepancies.map((d, idx) => (
                  <tr key={idx} className="border-b border-border hover:bg-muted/30">
                    <td className="py-2 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        d.type === 'stale_firebase' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                        d.type === 'missing_firebase' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                        {d.type === 'stale_firebase' ? 'Cancelled' :
                         d.type === 'missing_firebase' ? 'Missing' : 'Mismatch'}
                      </span>
                    </td>
                    <td className="py-2 px-2 truncate max-w-[200px]" title={d.email}>{d.email}</td>
                    <td className={`text-right py-2 px-2 ${d.stripeAmountCents === 0 ? 'opacity-30' : ''}`}>{formatUsdCents(d.stripeAmountCents)}</td>
                    <td className={`text-right py-2 px-2 ${d.firebaseAmountCents === 0 ? 'opacity-30' : ''}`}>{formatUsdCents(d.firebaseAmountCents)}</td>
                    <td className={`text-right py-2 px-2 ${(d.stripeAmountCents - d.firebaseAmountCents) === 0 ? 'opacity-30' : ''}`}>
                      {formatUsdCents(d.stripeAmountCents - d.firebaseAmountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Click &quot;Sync with Stripe&quot; to fix stale and mismatched records. Missing records will be created when users log in.
          </p>
        </div>
      )}
    </div>
  );
}
