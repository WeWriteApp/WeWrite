'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useAuth } from '../../providers/AuthProvider';
import { UnifiedPageList, PageListViewToggle } from '../pages/UnifiedPageList';
import type { PageItem, PageListView } from '../pages/UnifiedPageList';

interface GroupPage {
  id: string;
  title: string;
  userId: string;
  username?: string;
  lastModified: string;
}

interface UserPage {
  id: string;
  title: string;
  groupId?: string;
}

interface GroupPageListProps {
  groupId: string;
  isMember: boolean;
}

function AddExistingPageModal({
  groupId,
  onClose,
  onAdded,
}: {
  groupId: string;
  onClose: () => void;
  onAdded: (page: GroupPage) => void;
}) {
  const { user } = useAuth();
  const [userPages, setUserPages] = useState<UserPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addingPageId, setAddingPageId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserPages = async () => {
      if (!user?.uid) return;
      try {
        const res = await fetch(`/api/pages?userId=${user.uid}&limit=200`, { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.data) {
          const pages = (data.data.pages || data.data || []).filter(
            (p: any) => !p.deleted && !p.groupId
          );
          setUserPages(pages);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserPages();
  }, [user?.uid]);

  const filtered = userPages.filter((p) =>
    (p.title || 'Untitled').toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (page: UserPage) => {
    setAddingPageId(page.id);
    try {
      const res = await fetch(`/api/groups/${groupId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pageId: page.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onAdded({
          id: page.id,
          title: page.title || 'Untitled',
          userId: user?.uid || '',
          username: user?.displayName || '',
          lastModified: new Date().toISOString(),
        });
      }
    } catch {
      // ignore
    } finally {
      setAddingPageId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[70vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold">Add Existing Page</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
            <Icon name="X" size={20} />
          </button>
        </div>
        <div className="p-4 border-b border-border">
          <Input
            placeholder="Search your pages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Icon name="Loader" size={20} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {search ? 'No matching pages found.' : 'No available pages. Create a new page first.'}
            </div>
          ) : (
            filtered.map((page) => (
              <button
                key={page.id}
                onClick={() => handleAdd(page)}
                disabled={addingPageId === page.id}
                className="w-full text-left flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon name="FileText" size={16} className="text-muted-foreground flex-shrink-0" />
                  <span className="truncate text-sm">{page.title || 'Untitled'}</span>
                </div>
                {addingPageId === page.id ? (
                  <Icon name="Loader" size={16} className="flex-shrink-0" />
                ) : (
                  <Icon name="Plus" size={16} className="text-muted-foreground flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function GroupPageList({ groupId, isMember }: GroupPageListProps) {
  const router = useRouter();
  const [pages, setPages] = useState<GroupPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [view, setView] = useState<PageListView>('wrapped');

  useEffect(() => {
    const fetchPages = async () => {
      try {
        const res = await fetch(`/api/groups/${groupId}/pages`, { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.data?.pages) {
          setPages(data.data.pages);
        }
      } catch (error) {
        console.error('Error fetching group pages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPages();
  }, [groupId]);

  const handlePageAdded = (page: GroupPage) => {
    setPages((prev) => [page, ...prev]);
    setShowAddModal(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Icon name="Loader" size={20} />
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <>
        <div className="text-center py-8 text-muted-foreground">
          <Icon name="FileText" size={32} className="mx-auto mb-2 opacity-50" />
          <p>No pages in this group yet.</p>
          {isMember && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
              <Button
                variant="default"
                size="lg"
                className="gap-2 w-full sm:w-auto rounded-2xl font-medium"
                onClick={() => setShowAddModal(true)}
              >
                <Icon name="FolderPlus" size={20} />
                <span>Add Existing Page</span>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2 w-full sm:w-auto rounded-2xl font-medium"
                onClick={() => router.push(`/new?groupId=${groupId}`)}
              >
                <Icon name="Plus" size={20} />
                <span>Create New Page</span>
              </Button>
            </div>
          )}
        </div>
        {showAddModal && (
          <AddExistingPageModal
            groupId={groupId}
            onClose={() => setShowAddModal(false)}
            onAdded={handlePageAdded}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          {pages.length} page{pages.length !== 1 ? 's' : ''}
        </div>
        <PageListViewToggle view={view} onViewChange={setView} />
      </div>

      <UnifiedPageList
        pages={pages as PageItem[]}
        view={view}
        onViewChange={setView}
      />

      {isMember && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-2xl"
            onClick={() => setShowAddModal(true)}
          >
            <Icon name="FolderPlus" size={16} />
            <span>Add Existing Page</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-2xl"
            onClick={() => router.push(`/new?groupId=${groupId}`)}
          >
            <Icon name="Plus" size={16} />
            <span>Create New Page</span>
          </Button>
        </div>
      )}
      {showAddModal && (
        <AddExistingPageModal
          groupId={groupId}
          onClose={() => setShowAddModal(false)}
          onAdded={handlePageAdded}
        />
      )}
    </>
  );
}
