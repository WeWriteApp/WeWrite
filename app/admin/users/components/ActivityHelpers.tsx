import React from 'react';
import type { Activity } from '../types';

export function PillLink({ href, children, type = 'user' }: { href: string; children: React.ReactNode; type?: 'user' | 'page' }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors hover:opacity-80 ${
        type === 'user'
          ? 'bg-primary/15 text-primary border border-primary/30'
          : 'bg-secondary/30 text-secondary-foreground border border-secondary/50'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {type === 'user' && '@'}{children}
    </a>
  );
}

export function renderActivityDescription(activity: Activity) {
  const notificationType = activity.metadata?.notificationType;

  if (notificationType === 'link' && activity.sourceUsername && activity.targetPageTitle && activity.sourcePageTitle) {
    return (
      <span className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
        <PillLink href={`/u/${activity.sourceUsername}`} type="user">
          {activity.sourceUsername}
        </PillLink>
        <span>linked to</span>
        {activity.targetPageId ? (
          <PillLink href={`/${activity.targetPageId}`} type="page">
            {activity.targetPageTitle}
          </PillLink>
        ) : (
          <span className="font-medium">&quot;{activity.targetPageTitle}&quot;</span>
        )}
        <span>in their page</span>
        {activity.sourcePageId ? (
          <PillLink href={`/${activity.sourcePageId}`} type="page">
            {activity.sourcePageTitle}
          </PillLink>
        ) : (
          <span className="font-medium">&quot;{activity.sourcePageTitle}&quot;</span>
        )}
      </span>
    );
  }

  if (notificationType === 'user_mention' && activity.sourceUsername && activity.sourcePageTitle) {
    return (
      <span className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
        <PillLink href={`/u/${activity.sourceUsername}`} type="user">
          {activity.sourceUsername}
        </PillLink>
        <span>mentioned this user in</span>
        {activity.sourcePageId ? (
          <PillLink href={`/${activity.sourcePageId}`} type="page">
            {activity.sourcePageTitle}
          </PillLink>
        ) : (
          <span className="font-medium">&quot;{activity.sourcePageTitle}&quot;</span>
        )}
      </span>
    );
  }

  if (notificationType === 'follow' || activity.title?.includes('follower') || activity.title?.includes('followed')) {
    const followerMatch = activity.description?.match(/@(\w+)/);
    const followerUsername = followerMatch?.[1] || activity.sourceUsername || activity.metadata?.followerUsername;

    if (followerUsername) {
      return (
        <span className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
          <PillLink href={`/u/${followerUsername}`} type="user">
            {followerUsername}
          </PillLink>
          <span>started following this user</span>
        </span>
      );
    }
  }

  if (activity.type === 'payout' && activity.metadata?.pageId) {
    return (
      <span className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
        <span>{activity.description}</span>
        {activity.metadata.pageId && (
          <>
            <span>from</span>
            <PillLink href={`/${activity.metadata.pageId}`} type="page">
              {activity.metadata.pageTitle || 'page'}
            </PillLink>
          </>
        )}
      </span>
    );
  }

  return (
    <p className="text-xs text-muted-foreground mt-0.5">
      {activity.description}
    </p>
  );
}
