'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { SegmentedControl, SegmentedControlList, SegmentedControlTrigger } from '../ui/segmented-control';
import { SectionTitle } from '../ui/section-title';
import EmptyState from '../ui/EmptyState';
import TimelineCalendar from '../timeline/TimelineCalendar';
import dynamic from 'next/dynamic';

const TimelineCarousel = dynamic(() => import('../timeline/TimelineCarousel'), { ssr: false });

interface GroupTimelineTabProps {
  groupId: string;
  groupName: string;
}

interface TimelinePage {
  id: string;
  title: string;
  customDate: string;
  lastModified?: string;
  createdAt?: string;
}

export default function GroupTimelineTab({ groupId, groupName }: GroupTimelineTabProps) {
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('timeline');
  const [pages, setPages] = useState<TimelinePage[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch group timeline pages
  useEffect(() => {
    async function fetchTimelinePages() {
      try {
        setLoading(true);
        const response = await fetch(`/api/timeline?groupId=${encodeURIComponent(groupId)}`);
        if (!response.ok) throw new Error('Failed to fetch timeline pages');
        const result = await response.json();
        setPages(result.pages || []);
      } catch (error) {
        console.error('Error fetching group timeline:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTimelinePages();
  }, [groupId]);

  // Build notesByDate map for the carousel
  const notesByDate = useMemo(() => {
    const map = new Map<string, { id: string; title: string }[]>();
    pages.forEach(page => {
      if (page.customDate) {
        if (!map.has(page.customDate)) {
          map.set(page.customDate, []);
        }
        map.get(page.customDate)!.push({ id: page.id, title: page.title });
      }
    });
    return map;
  }, [pages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon name="Loader" />
          <span>Loading timeline...</span>
        </div>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <EmptyState
        icon="Calendar"
        title="No timeline entries"
        description="This group doesn't have any pages with custom dates yet. Pages can have dates assigned when editing."
        size="lg"
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle icon="Clock" title="Group Timeline" />

      {/* View Mode Toggle */}
      <div className="flex justify-center">
        <SegmentedControl value={viewMode} onValueChange={(v: string) => setViewMode(v as 'timeline' | 'calendar')}>
          <SegmentedControlList className="grid w-full grid-cols-2 max-w-sm">
            <SegmentedControlTrigger value="timeline" className="flex items-center gap-2">
              <Icon name="List" size={16} />
              Timeline
            </SegmentedControlTrigger>
            <SegmentedControlTrigger value="calendar" className="flex items-center gap-2">
              <Icon name="Calendar" size={16} />
              Calendar
            </SegmentedControlTrigger>
          </SegmentedControlList>
        </SegmentedControl>
      </div>

      {viewMode === 'timeline' ? (
        <div className="relative" id="group-timeline-carousel">
          <TimelineCarousel
            externalNotesByDate={notesByDate}
            externalLoading={false}
          />
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          <TimelineCalendar groupId={groupId} />
        </div>
      )}
    </div>
  );
}
