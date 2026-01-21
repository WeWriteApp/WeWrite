"use client";

import React from 'react';
import { UsernameBadge } from '../../components/ui/UsernameBadge';
import { ComponentShowcase, StateDemo, CollapsibleDocs, DocsCodeBlock } from './shared';

export function UsernameBadgeSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="UsernameBadge"
      path="app/components/ui/UsernameBadge.tsx"
      description="Displays a user's username with subscription tier badge. Only requires userId, username, and tier - the tier is pre-computed by APIs. Supports link and pill variants."
    >
      <StateDemo label="Link Variant (default)">
        <div className="flex flex-wrap gap-4 items-center">
          <UsernameBadge
            userId="user1"
            username="alex"
            tier="inactive"
            variant="link"
          />
          <UsernameBadge
            userId="user2"
            username="sarah"
            tier="tier1"
            variant="link"
          />
          <UsernameBadge
            userId="user3"
            username="jamie"
            tier="tier2"
            variant="link"
          />
          <UsernameBadge
            userId="user4"
            username="taylor"
            tier="tier3"
            variant="link"
          />
        </div>
      </StateDemo>

      <StateDemo label="Pill Variant - Primary">
        <div className="flex flex-wrap gap-2 items-center">
          <UsernameBadge
            userId="user1"
            username="alex"
            tier="inactive"
            variant="pill"
            pillVariant="primary"
          />
          <UsernameBadge
            userId="user2"
            username="sarah"
            tier="tier1"
            variant="pill"
            pillVariant="primary"
          />
          <UsernameBadge
            userId="user3"
            username="jamie"
            tier="tier2"
            variant="pill"
            pillVariant="primary"
          />
          <UsernameBadge
            userId="user4"
            username="taylor"
            tier="tier3"
            variant="pill"
            pillVariant="primary"
          />
        </div>
      </StateDemo>


      <StateDemo label="Pill Variant - Outline">
        <div className="flex flex-wrap gap-2 items-center">
          <UsernameBadge
            userId="user1"
            username="alex"
            tier="inactive"
            variant="pill"
            pillVariant="outline"
          />
          <UsernameBadge
            userId="user2"
            username="sarah"
            tier="tier2"
            variant="pill"
            pillVariant="outline"
          />
        </div>
      </StateDemo>

      <StateDemo label="Without Badge">
        <div className="flex flex-wrap gap-4 items-center">
          <UsernameBadge
            userId="user1"
            username="alex"
            tier="tier3"
            variant="link"
            showBadge={false}
          />
          <UsernameBadge
            userId="user2"
            username="sarah"
            tier="tier3"
            variant="pill"
            pillVariant="primary"
            showBadge={false}
          />
        </div>
      </StateDemo>

      <StateDemo label="Sizes">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">sm:</span>
            <UsernameBadge
              userId="user1"
              username="alex"
              tier="tier2"
              size="sm"
              variant="link"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">md:</span>
            <UsernameBadge
              userId="user2"
              username="sarah"
              tier="tier2"
              size="md"
              variant="link"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">lg:</span>
            <UsernameBadge
              userId="user3"
              username="jamie"
              tier="tier2"
              size="lg"
              variant="link"
            />
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Subscription Tiers">
        <div className="wewrite-card p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground mb-3">
            The badge shows stars based on subscription tier. The tier is pre-computed by APIs using getEffectiveTier().
          </p>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex flex-col items-center gap-1">
              <UsernameBadge
                userId="inactive"
                username="inactive"
                tier="inactive"
                variant="link"
              />
              <span className="text-xs text-muted-foreground">inactive</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <UsernameBadge
                userId="tier1"
                username="tier1"
                tier="tier1"
                variant="link"
              />
              <span className="text-xs text-muted-foreground">tier1 ($10/mo)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <UsernameBadge
                userId="tier2"
                username="tier2"
                tier="tier2"
                variant="link"
              />
              <span className="text-xs text-muted-foreground">tier2 ($20/mo)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <UsernameBadge
                userId="tier3"
                username="tier3"
                tier="tier3"
                variant="link"
              />
              <span className="text-xs text-muted-foreground">tier3 ($30+/mo)</span>
            </div>
          </div>
        </div>
      </StateDemo>

      <CollapsibleDocs type="api">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <strong>Simplified Props:</strong> Only <code className="bg-muted px-1 rounded">tier</code> is needed now. APIs pre-compute the effective tier.
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Auto-fetch:</strong> If tier is not provided, the component fetches it from <code className="bg-muted px-1 rounded">/api/users/full-profile</code>.
          </p>
          <DocsCodeBlock label="Usage Examples">
{`// Minimal usage (tier auto-fetched)
<UsernameBadge userId="abc" username="jamie" />

// With pre-fetched tier
<UsernameBadge userId="abc" username="jamie" tier="tier2" />`}
          </DocsCodeBlock>
        </div>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
