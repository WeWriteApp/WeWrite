import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '../../../components/ui/table';

interface HistoricalDataProps {
  historicalData: MonthlyFinancialData[];
  totals: FinancialsResponse['totals'];
  formatMonth: (month: string) => string;
}

export function HistoricalData({ historicalData, totals, formatMonth }: HistoricalDataProps) {
  return (
    <>
      {/* Historical Data Table */}
      <div className="wewrite-card">
        <div className="flex items-center gap-2 mb-4 flex-col sm:flex-row">
          <Icon name="TrendingUp" size={20} />
          <h2 className="text-lg sm:text-xl font-bold">Historical Monthly Data</h2>
        </div>

        {historicalData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No historical data yet.</p>
            <p className="text-xs mt-1">Data will appear after the first month-end processing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full text-xs sm:text-sm">
              <TableHeader>
                <TableRow className="border-b border-border">
                  <TableHead className="text-left py-3 px-2">Month</TableHead>
                  <TableHead className="py-3 px-2">Subscriptions</TableHead>
                  <TableHead className="py-3 px-2">Allocated</TableHead>
                  <TableHead className="py-3 px-2">Unallocated</TableHead>
                  <TableHead className="py-3 px-2">Platform Fee</TableHead>
                  <TableHead className="py-3 px-2">Creator Payouts</TableHead>
                  <TableHead className="py-3 px-2">Platform Revenue</TableHead>
                  <TableHead className="py-3 px-2">Allocation %</TableHead>
                  <TableHead className="py-3 px-2">Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicalData.map((row) => (
                  <TableRow key={row.month} className="border-b border-border hover:bg-muted/50">
                    <TableCell className="py-3 px-2 font-medium">{formatMonth(row.month)}</TableCell>
                    <TableCell kind="currency" className={`py-3 px-2 ${row.totalSubscriptionCents === 0 ? 'opacity-30' : ''}`}>{formatUsdCents(row.totalSubscriptionCents)}</TableCell>
                    <TableCell kind="currency" className={`py-3 px-2 ${row.totalAllocatedCents === 0 ? 'opacity-30' : ''}`}>{formatUsdCents(row.totalAllocatedCents)}</TableCell>
                    <TableCell kind="currency" className={`py-3 px-2 ${row.totalUnallocatedCents === 0 ? 'opacity-30' : 'text-green-700 dark:text-green-400'}`}>{formatUsdCents(row.totalUnallocatedCents)}</TableCell>
                    <TableCell kind="currency" className={`py-3 px-2 ${row.platformFeeCents === 0 ? 'opacity-30' : 'text-green-700 dark:text-green-400'}`}>{formatUsdCents(row.platformFeeCents)}</TableCell>
                    <TableCell kind="currency" className={`py-3 px-2 ${row.creatorPayoutsCents === 0 ? 'opacity-30' : ''}`}>{formatUsdCents(row.creatorPayoutsCents)}</TableCell>
                    <TableCell kind="currency" className={`py-3 px-2 font-medium ${row.platformRevenueCents === 0 ? 'opacity-30' : 'text-green-700 dark:text-green-400'}`}>{formatUsdCents(row.platformRevenueCents)}</TableCell>
                    <TableCell kind="number" className={`py-3 px-2 ${row.allocationRate === 0 ? 'opacity-30' : ''}`}>{row.allocationRate.toFixed(1)}%</TableCell>
                    <TableCell kind="number" className={`py-3 px-2 ${row.userCount === 0 ? 'opacity-30' : ''}`}>{row.userCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {historicalData.length > 0 && (
                <TableFooter>
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell className="py-3 px-2">Totals</TableCell>
                    <TableCell kind="currency" className="py-3 px-2">{formatUsdCents(totals.totalSubscriptionCents)}</TableCell>
                    <TableCell kind="currency" className="py-3 px-2">{formatUsdCents(totals.totalAllocatedCents)}</TableCell>
                    <TableCell kind="currency" className="py-3 px-2 text-green-700 dark:text-green-400">{formatUsdCents(totals.totalUnallocatedCents)}</TableCell>
                    <TableCell kind="currency" className="py-3 px-2 text-green-700 dark:text-green-400">{formatUsdCents(totals.totalPlatformFeeCents)}</TableCell>
                    <TableCell kind="currency" className="py-3 px-2">{formatUsdCents(totals.totalCreatorPayoutsCents)}</TableCell>
                    <TableCell kind="currency" className="py-3 px-2 text-green-700 dark:text-green-400">{formatUsdCents(totals.totalPlatformRevenueCents)}</TableCell>
                    <TableCell kind="number" className="py-3 px-2">{totals.averageAllocationRate.toFixed(1)}%</TableCell>
                    <TableCell kind="number" className="py-3 px-2">-</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        )}
      </div>

      {/* Monthly Trends Chart */}
      <div className="wewrite-card">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="TrendingUp" size={20} />
          <h2 className="text-xl font-bold">Monthly Trends</h2>
        </div>

        {historicalData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Charts will appear after historical data is available.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Allocation vs Unallocated by Month</h3>
              {historicalData.slice().reverse().map((row) => {
                const maxValue = Math.max(...historicalData.map(d => d.totalSubscriptionCents));
                const allocatedWidth = maxValue > 0 ? (row.totalAllocatedCents / maxValue) * 100 : 0;
                const unallocatedWidth = maxValue > 0 ? (row.totalUnallocatedCents / maxValue) * 100 : 0;

                return (
                  <div key={row.month} className="flex items-center gap-2">
                    <span className="w-24 text-sm text-muted-foreground">{formatMonth(row.month)}</span>
                    <div className="flex-1 flex h-6 gap-0.5 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-zinc-400 dark:bg-zinc-600 transition-all"
                        style={{ width: `${allocatedWidth}%` }}
                        title={`Allocated: ${formatUsdCents(row.totalAllocatedCents)}`}
                      />
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${unallocatedWidth}%` }}
                        title={`Unallocated: ${formatUsdCents(row.totalUnallocatedCents)}`}
                      />
                    </div>
                    <span className="w-20 text-sm text-right">{formatUsdCents(row.totalSubscriptionCents)}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 text-sm pt-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-zinc-400 dark:bg-zinc-600 rounded" />
                <span>Allocated to Creators</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span>Unallocated (Platform Revenue)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
