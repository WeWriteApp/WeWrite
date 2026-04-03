'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/card';
import { Icon } from '../ui/Icon';
import { Input } from '../ui/input';
import type { Group } from '../../types/groups';

interface GroupSettingsTabProps {
  group: Group;
  onGroupUpdated: (updates: Partial<Group>) => void;
}

export default function GroupSettingsTab({ group, onGroupUpdated }: GroupSettingsTabProps) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [visibility, setVisibility] = useState<'public' | 'private'>(group.visibility || 'public');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, visibility }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to save');
        return;
      }

      setSuccess(true);
      onGroupUpdated({ name, visibility });
    } catch (err: any) {
      setError(err?.message || 'Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this group? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        router.push('/groups');
      }
    } catch {
      setError('Failed to delete group');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Name</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          <p className="text-sm text-muted-foreground mb-3">
            Edit the group description on the <strong>About</strong> tab.
          </p>

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
                <span className="text-sm font-medium">Public</span>
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
                <span className="text-sm font-medium">Private</span>
              </button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div>
            {error && <span className="text-sm text-destructive">{error}</span>}
            {success && <span className="text-sm text-green-600">Saved!</span>}
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </CardFooter>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Deleting this group will remove all members and unlink all pages.
          </p>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg font-medium hover:bg-destructive/90 transition-colors"
          >
            Delete Group
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
