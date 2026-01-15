'use client';

import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/badge';

interface ScheduledBatch {
  scheduledFor: string;
  count: number;
  templateBreakdown: Record<string, number>;
}

interface ScheduledBatchItemProps {
  batch: ScheduledBatch;
  isExpanded: boolean;
  onToggle: () => void;
  formatBatchDate: (dateString: string) => string;
}

/**
 * Expandable row showing a scheduled email batch with template breakdown
 */
export function ScheduledBatchItem({
  batch,
  isExpanded,
  onToggle,
  formatBatchDate,
}: ScheduledBatchItemProps) {
  const templateEntries = Object.entries(batch.templateBreakdown);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Icon
            name={isExpanded ? 'ChevronDown' : 'ChevronRight'}
            size={16}
            className="text-muted-foreground"
          />
          <div className="text-left">
            <div className="font-medium text-sm">{formatBatchDate(batch.scheduledFor)}</div>
            <div className="text-xs text-muted-foreground">{batch.scheduledFor}</div>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">
          {batch.count} {batch.count === 1 ? 'email' : 'emails'}
        </Badge>
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 pt-1 bg-muted/10">
          <div className="space-y-1">
            {templateEntries.map(([templateId, count]) => (
              <div
                key={templateId}
                className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted/20"
              >
                <span className="text-muted-foreground">{templateId}</span>
                <Badge variant="outline" className="text-xs">
                  {count}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
