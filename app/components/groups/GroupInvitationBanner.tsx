'use client';

import React, { useEffect, useState } from 'react';
import { Icon } from '../ui/Icon';
import { useFeatureFlags } from '../../contexts/FeatureFlagContext';

interface Invitation {
  id: string;
  groupName: string;
  inviterUsername: string;
}

export function GroupInvitationBanner() {
  const { isEnabled } = useFeatureFlags();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!isEnabled('groups')) return;

    const fetchInvitations = async () => {
      try {
        const res = await fetch('/api/groups/invitations', { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.data?.invitations) {
          setInvitations(data.data.invitations);
        }
      } catch {
        // Silently ignore
      }
    };

    fetchInvitations();
  }, [isEnabled]);

  const handleAction = async (invitationId: string, action: 'accept' | 'decline') => {
    setProcessing(invitationId);
    try {
      const res = await fetch('/api/groups/invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ invitationId, action }),
      });

      if (res.ok) {
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      }
    } catch {
      // Silently ignore
    } finally {
      setProcessing(null);
    }
  };

  if (!isEnabled('groups') || invitations.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {invitations.map((inv) => (
        <div
          key={inv.id}
          className="flex items-center justify-between gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="Users" size={16} className="text-primary shrink-0" />
            <span className="text-sm truncate">
              <strong>{inv.inviterUsername}</strong> invited you to{' '}
              <strong>{inv.groupName}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleAction(inv.id, 'accept')}
              disabled={processing === inv.id}
              className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              Accept
            </button>
            <button
              onClick={() => handleAction(inv.id, 'decline')}
              disabled={processing === inv.id}
              className="px-3 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-md hover:bg-muted/80 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
