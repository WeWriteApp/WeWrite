'use client';

interface QuotaCardProps {
  label: string;
  sent: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  remainingLabel: string;
}

/**
 * Displays a single quota usage card with progress bar
 * Used for daily and monthly email quota displays
 */
export function QuotaCard({
  label,
  sent,
  limit,
  remaining,
  percentUsed,
  remainingLabel,
}: QuotaCardProps) {
  const getColorClass = (percent: number) => {
    if (percent >= 90) return 'text-red-500';
    if (percent >= 70) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getBarColorClass = (percent: number) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="wewrite-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className={`text-xs font-medium ${getColorClass(percentUsed)}`}>
          {sent} / {limit}
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all ${getBarColorClass(percentUsed)}`}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground">
        {remaining} {remainingLabel}
      </div>
    </div>
  );
}
