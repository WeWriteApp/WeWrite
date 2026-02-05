'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../ui/Icon';
import type { GroupMember } from '../../types/groups';

interface FundDistributionEditorProps {
  groupId: string;
  members: GroupMember[];
  initialDistribution: Record<string, number>;
  canEdit: boolean;
  onSaved?: (distribution: Record<string, number>) => void;
}

export function FundDistributionEditor({
  groupId,
  members,
  initialDistribution,
  canEdit,
  onSaved,
}: FundDistributionEditorProps) {
  const [distribution, setDistribution] = useState<Record<string, number>>(initialDistribution);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setDistribution(initialDistribution);
    setIsDirty(false);
  }, [initialDistribution]);

  const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
  const isValid = Math.abs(total - 100) < 0.01;

  const handleChange = useCallback((userId: string, value: number) => {
    setDistribution((prev) => ({ ...prev, [userId]: value }));
    setIsDirty(true);
    setError(null);
  }, []);

  const handleEqualSplit = useCallback(() => {
    const count = members.length;
    if (count === 0) return;

    const base = Math.floor(100 / count);
    const remainder = 100 - base * count;
    const newDist: Record<string, number> = {};

    members.forEach((member, i) => {
      newDist[member.userId] = base + (i < remainder ? 1 : 0);
    });

    setDistribution(newDist);
    setIsDirty(true);
    setError(null);
  }, [members]);

  const handleSave = async () => {
    if (!isValid) {
      setError(`Percentages must sum to 100 (currently ${total})`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/groups/${groupId}/fund-distribution`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundDistribution: distribution }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Failed to save');
        return;
      }

      setIsDirty(false);
      onSaved?.(distribution);
    } catch {
      setError('Failed to save distribution');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Fund Distribution</h3>
        {canEdit && members.length > 1 && (
          <button
            onClick={handleEqualSplit}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Split equally
          </button>
        )}
      </div>

      <div className="space-y-3">
        {members.map((member) => {
          const percentage = distribution[member.userId] ?? 0;

          return (
            <div key={member.userId} className="flex items-center gap-3">
              <span className="text-sm min-w-[100px] truncate">
                {member.username || member.userId.slice(0, 8)}
                {member.role === 'owner' && (
                  <span className="ml-1 text-xs text-muted-foreground">(owner)</span>
                )}
              </span>

              <div className="flex-1">
                <div className="relative">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={percentage}
                    onChange={(e) => handleChange(member.userId, Number(e.target.value))}
                    disabled={!canEdit}
                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-default [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1 min-w-[60px] justify-end">
                {canEdit ? (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={percentage}
                    onChange={(e) => handleChange(member.userId, Number(e.target.value) || 0)}
                    className="w-12 text-right text-sm bg-transparent border border-border rounded px-1 py-0.5"
                  />
                ) : (
                  <span className="text-sm tabular-nums">{percentage}</span>
                )}
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total indicator */}
      <div className={`flex items-center justify-between text-sm pt-2 border-t border-border ${
        !isValid ? 'text-destructive' : 'text-muted-foreground'
      }`}>
        <span>Total</span>
        <span className="font-medium tabular-nums">{total}%</span>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {canEdit && isDirty && (
        <button
          onClick={handleSave}
          disabled={!isValid || isSaving}
          className="w-full px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isSaving ? <Icon name="Loader" size={16} /> : 'Save Distribution'}
        </button>
      )}
    </div>
  );
}
