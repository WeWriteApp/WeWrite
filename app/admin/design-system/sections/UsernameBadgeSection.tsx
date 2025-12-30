"use client";

import React from 'react';
import { UsernameBadge } from '../../../components/ui/UsernameBadge';
import { ComponentShowcase, StateDemo } from './shared';

export function UsernameBadgeSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="UsernameBadge"
      path="app/components/ui/UsernameBadge.tsx"
      description="Displays a user's username with subscription tier badge. Supports link and pill variants with different styling options."
    >
      <StateDemo label="Link Variant (default)">
        <div className="flex flex-wrap gap-4 items-center">
          <UsernameBadge
            userId="user1"
            username="alex"
            tier={null}
            subscriptionStatus={null}
            subscriptionAmount={null}
            variant="link"
          />
          <UsernameBadge
            userId="user2"
            username="sarah"
            tier="tier1"
            subscriptionStatus="active"
            subscriptionAmount={10}
            variant="link"
          />
          <UsernameBadge
            userId="user3"
            username="jamie"
            tier="tier2"
            subscriptionStatus="active"
            subscriptionAmount={20}
            variant="link"
          />
          <UsernameBadge
            userId="user4"
            username="taylor"
            tier="tier3"
            subscriptionStatus="active"
            subscriptionAmount={35}
            variant="link"
          />
        </div>
      </StateDemo>

      <StateDemo label="Pill Variant - Primary">
        <div className="flex flex-wrap gap-2 items-center">
          <UsernameBadge
            userId="user1"
            username="alex"
            tier={null}
            subscriptionStatus={null}
            subscriptionAmount={null}
            variant="pill"
            pillVariant="primary"
          />
          <UsernameBadge
            userId="user2"
            username="sarah"
            tier="tier1"
            subscriptionStatus="active"
            subscriptionAmount={10}
            variant="pill"
            pillVariant="primary"
          />
          <UsernameBadge
            userId="user3"
            username="jamie"
            tier="tier2"
            subscriptionStatus="active"
            subscriptionAmount={20}
            variant="pill"
            pillVariant="primary"
          />
          <UsernameBadge
            userId="user4"
            username="taylor"
            tier="tier3"
            subscriptionStatus="active"
            subscriptionAmount={35}
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
            tier={null}
            subscriptionStatus={null}
            subscriptionAmount={null}
            variant="pill"
            pillVariant="outline"
          />
          <UsernameBadge
            userId="user2"
            username="sarah"
            tier="tier2"
            subscriptionStatus="active"
            subscriptionAmount={20}
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
            subscriptionStatus="active"
            subscriptionAmount={35}
            variant="link"
            showBadge={false}
          />
          <UsernameBadge
            userId="user2"
            username="sarah"
            tier="tier3"
            subscriptionStatus="active"
            subscriptionAmount={35}
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
              subscriptionStatus="active"
              subscriptionAmount={20}
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
              subscriptionStatus="active"
              subscriptionAmount={20}
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
              subscriptionStatus="active"
              subscriptionAmount={20}
              size="lg"
              variant="link"
            />
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Subscription Tiers">
        <div className="wewrite-card p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground mb-3">
            The badge shows stars based on subscription tier. Inactive users show a crossed-out circle.
          </p>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex flex-col items-center gap-1">
              <UsernameBadge
                userId="inactive"
                username="inactive"
                tier={null}
                subscriptionStatus={null}
                subscriptionAmount={null}
                variant="link"
              />
              <span className="text-xs text-muted-foreground">No sub</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <UsernameBadge
                userId="tier1"
                username="tier1"
                tier="tier1"
                subscriptionStatus="active"
                subscriptionAmount={10}
                variant="link"
              />
              <span className="text-xs text-muted-foreground">$10/mo (1 star)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <UsernameBadge
                userId="tier2"
                username="tier2"
                tier="tier2"
                subscriptionStatus="active"
                subscriptionAmount={20}
                variant="link"
              />
              <span className="text-xs text-muted-foreground">$20/mo (2 stars)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <UsernameBadge
                userId="tier3"
                username="tier3"
                tier="tier3"
                subscriptionStatus="active"
                subscriptionAmount={30}
                variant="link"
              />
              <span className="text-xs text-muted-foreground">$30+/mo (3 stars)</span>
            </div>
          </div>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
