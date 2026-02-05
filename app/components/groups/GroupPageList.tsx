'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../ui/Icon';

interface GroupPage {
  id: string;
  title: string;
  userId: string;
  username?: string;
  lastModified: string;
}

interface GroupPageListProps {
  groupId: string;
  isMember: boolean;
}

export function GroupPageList({ groupId, isMember }: GroupPageListProps) {
  const [pages, setPages] = useState<GroupPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Icon name="Loader" size={20} />
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Icon name="FileText" size={32} className="mx-auto mb-2 opacity-50" />
        <p>No pages in this group yet.</p>
        {isMember && <p className="text-sm mt-1">Add a page to get started.</p>}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {pages.map((page) => (
        <Link
          key={page.id}
          href={`/${page.id}`}
          className="block py-3 px-1 hover:bg-muted/50 rounded transition-colors"
        >
          <div className="font-medium">{page.title || 'Untitled'}</div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {page.username && <span>by {page.username}</span>}
            {page.lastModified && (
              <span className="ml-2">
                {new Date(page.lastModified).toLocaleDateString()}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
