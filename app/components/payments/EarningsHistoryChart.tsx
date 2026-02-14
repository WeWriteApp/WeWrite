"use client";

import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { useEarnings } from '../../contexts/EarningsContext';
import { formatUsdCents } from '../../utils/formatCurrency';
import { cn } from '../../lib/utils';

type HistoryEntry = {
  month: string; // YYYY-MM
  netEarnings?: number;
  totalEarnings?: number;
  grossEarnings?: number;
  paidOut?: number;
};

// Build a list of months ending at current month, newest last
const buildMonths = (count: number): string[] => {
  const result: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    result.push(key);
  }
  return result;
};

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString('en', { month: 'short' });
};

const RANGE_PRESETS: Record<string, number> = {
  all: 36,
  '2y': 24,
  '1y': 12,
  '3m': 3,
  '1m': 1
};

const RangePill = ({
  label,
  value,
  active,
  onClick
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: (v: string) => void;
}) => (
  <button
    onClick={() => onClick(value)}
    className={cn(
      'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
      active
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'bg-muted/80 text-muted-foreground hover:text-foreground'
    )}
  >
    {label}
  </button>
);

export default function EarningsHistoryChart() {
  const { earnings, isLoading } = useEarnings();
  const [range, setRange] = useState<string>('2y');

  const chartData = useMemo(() => {
    const monthsToShow = RANGE_PRESETS[range] ?? RANGE_PRESETS['2y'];
    const baseMonths = buildMonths(monthsToShow);
    const historyMap = new Map<string, HistoryEntry>();
    (earnings?.earningsHistory || []).forEach(entry => {
      historyMap.set(entry.month, entry);
    });

    return baseMonths.map(monthKey => {
      const entry = historyMap.get(monthKey);
      const net = entry?.netEarnings ?? entry?.totalEarnings ?? entry?.grossEarnings ?? 0;
      return {
        monthKey,
        label: formatMonthLabel(monthKey),
        net
      };
    });
  }, [earnings?.earningsHistory, range]);

  const maxNet = useMemo(
    () => Math.max(0, ...chartData.map((d) => d.net ?? 0)),
    [chartData]
  );

  const recentHighlightCount = Math.max(3, Math.min(8, chartData.length));

  return (
    <Card className="bg-card border border-border/60 shadow-xl">
      <CardHeader className="pb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base sm:text-lg">Earnings over time</CardTitle>
        <div className="flex flex-wrap gap-2">
          <RangePill label="All" value="all" active={range === 'all'} onClick={setRange} />
          <RangePill label="2 yr" value="2y" active={range === '2y'} onClick={setRange} />
          <RangePill label="1 yr" value="1y" active={range === '1y'} onClick={setRange} />
          <RangePill label="3 mo" value="3m" active={range === '3m'} onClick={setRange} />
          <RangePill label="1 mo" value="1m" active={range === '1m'} onClick={setRange} />
        </div>
      </CardHeader>
      <CardContent className="h-64 sm:h-72 px-4 sm:px-5 pb-4 pt-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Loading chart...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            >
              <Tooltip
                formatter={(value: any) => formatUsdCents((Number(value) || 0) * 100)}
                labelFormatter={(label) => label}
                contentStyle={{
                  background: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  color: 'var(--foreground)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                }}
                itemStyle={{
                  color: 'var(--foreground)',
                  fontSize: 12
                }}
                labelStyle={{
                  color: 'var(--muted-foreground)',
                  fontWeight: 600,
                  fontSize: 12
                }}
                cursor={{ fill: 'var(--muted)', opacity: 0.08 }}
              />
              <Bar
                dataKey="net"
                radius={[6, 6, 3, 3]}
                maxBarSize={28}
                background={{ fill: 'var(--muted)', radius: 2, opacity: 0.14 }}
              >
                {chartData.map((entry, index) => {
                  const isRecent = index >= chartData.length - recentHighlightCount;
                  const hasValue = (entry.net ?? 0) > 0;
                  const fill = isRecent && hasValue
                    ? 'var(--primary)'
                    : 'var(--muted-foreground)';
                  const opacity = isRecent && hasValue ? 1 : 0.45;
                  return <Cell key={entry.monthKey} fill={fill} opacity={opacity} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
