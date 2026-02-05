'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../../components/ui/card';
import NavPageLayout from '../../../components/layout/NavPageLayout';
import { Icon } from '../../../components/ui/Icon';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { PageHeader } from '../../../components/ui/PageHeader';
import type { Group } from '../../../types/groups';

export default function GroupSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const slug = params.slug as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        // First get group by slug to get the ID
        const listRes = await fetch('/api/groups', { credentials: 'include' });
        const listData = await listRes.json();
        if (listData.success && listData.data?.groups) {
          const found = listData.data.groups.find((g: any) => g.slug === slug);
          if (found) {
            const res = await fetch(`/api/groups/${found.id}`, { credentials: 'include' });
            const data = await res.json();
            if (data.success && data.data) {
              setGroup(data.data);
              setName(data.data.name);
              setDescription(data.data.description || '');
              setVisibility(data.data.visibility || 'public');
            }
          }
        }
      } catch {
        setError('Failed to load group');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroup();
  }, [slug]);

  const handleSave = async () => {
    if (!group) return;
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, description, visibility }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to save');
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!group) return;
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Icon name="Loader" size={24} />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Group not found</p>
      </div>
    );
  }

  // Only owner can access settings
  if (group.ownerId !== user?.uid) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Only the group owner can access settings</p>
      </div>
    );
  }

  return (
    <NavPageLayout>
      <PageHeader title="Group Settings" backHref={true} />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
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

          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={3}
              maxLength={500}
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

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
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
    </NavPageLayout>
  );
}
