'use client';

import React, { useState } from 'react';
import { AdaptiveModal } from '../ui/adaptive-modal';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  onInvited: () => void;
}

export function InviteMemberModal({ isOpen, onClose, groupId, onInvited }: InviteMemberModalProps) {
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      // Look up user by username
      const userRes = await fetch(`/api/users?username=${encodeURIComponent(username.trim())}`, {
        credentials: 'include',
      });
      const userData = await userRes.json();

      if (!userRes.ok || !userData.success || !userData.data?.user) {
        setError('User not found');
        return;
      }

      const inviteeId = userData.data.user.uid || userData.data.user.id;

      // Send invitation
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          inviteeId,
          inviteeUsername: username.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to send invitation');
        return;
      }

      setSuccess(true);
      setUsername('');
      onInvited();
    } catch (err: any) {
      setError(err?.message || 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdaptiveModal isOpen={isOpen} onClose={onClose} title="Invite Member">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError(null);
              setSuccess(false);
            }}
            placeholder="Enter username"
            className="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="text-sm text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-3 py-2 rounded-lg">
            Invitation sent!
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !username.trim()}
          className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Sending...' : 'Send Invitation'}
        </button>
      </form>
    </AdaptiveModal>
  );
}
