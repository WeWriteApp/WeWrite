'use client';

import React, { useState } from 'react';
import { AdaptiveModal } from '../ui/adaptive-modal';
import { Icon } from '../ui/Icon';
import { Input } from '../ui/input';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (group: any) => void;
}

export function CreateGroupModal({ isOpen, onClose, onCreated }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), visibility }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to create group');
        return;
      }

      onCreated(data.data);
      onClose();
      setName('');
      setVisibility('public');
    } catch (err: any) {
      setError(err?.message || 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdaptiveModal isOpen={isOpen} onClose={onClose} title="Create a Group">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Name</label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Writing Group"
            required
            maxLength={100}
            autoFocus
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Visibility</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setVisibility('public')}
              className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                visibility === 'public'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <Icon name="Globe" size={16} />
              <div className="text-left">
                <div className="text-sm font-medium">Public</div>
                <div className="text-xs text-muted-foreground">Anyone can see pages</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setVisibility('private')}
              className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                visibility === 'private'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <Icon name="Lock" size={16} />
              <div className="text-left">
                <div className="text-sm font-medium">Private</div>
                <div className="text-xs text-muted-foreground">Members only</div>
              </div>
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Creating...' : 'Create Group'}
        </button>
      </form>
    </AdaptiveModal>
  );
}
