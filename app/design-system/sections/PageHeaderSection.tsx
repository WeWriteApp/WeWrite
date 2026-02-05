"use client";

import React from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/Icon';
import { ComponentShowcase, StateDemo, CollapsibleDocs, DocsCodeBlock } from './shared';

export function PageHeaderSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Page Header"
      path="app/components/ui/PageHeader.tsx"
      description="Standardized page header component ensuring consistent title size (text-2xl), spacing (mb-6), and layout across all pages."
    >
      <StateDemo label="Basic">
        <div className="w-full border border-border rounded-lg p-4 bg-background">
          <PageHeader title="Page Title" className="mb-0" />
        </div>
      </StateDemo>

      <StateDemo label="With Description">
        <div className="w-full border border-border rounded-lg p-4 bg-background">
          <PageHeader
            title="Recently Viewed"
            description="Pages you've viewed recently"
            className="mb-0"
          />
        </div>
      </StateDemo>

      <StateDemo label="With Icon">
        <div className="w-full border border-border rounded-lg p-4 bg-background">
          <PageHeader
            title="Leaderboards"
            icon="Trophy"
            iconClassName="text-yellow-500"
            className="mb-0"
          />
        </div>
      </StateDemo>

      <StateDemo label="With Back Button">
        <div className="w-full border border-border rounded-lg p-4 bg-background">
          <PageHeader
            title="Group Settings"
            backHref={true}
            className="mb-0"
          />
        </div>
      </StateDemo>

      <StateDemo label="With Actions">
        <div className="w-full border border-border rounded-lg p-4 bg-background">
          <PageHeader
            title="Groups"
            actions={
              <Button size="sm">
                <Icon name="Plus" size={14} className="mr-1.5" />
                New Group
              </Button>
            }
            className="mb-0"
          />
        </div>
      </StateDemo>

      <StateDemo label="With Badges">
        <div className="w-full border border-border rounded-lg p-4 bg-background">
          <PageHeader
            title="My Private Group"
            badges={
              <Badge variant="secondary" size="sm">
                <Icon name="Lock" size={12} className="mr-1" />
                Private
              </Badge>
            }
            className="mb-0"
          />
        </div>
      </StateDemo>

      <StateDemo label="Full Featured">
        <div className="w-full border border-border rounded-lg p-4 bg-background">
          <PageHeader
            title="Writing Circle"
            description="A collaborative group for creative writers"
            badges={
              <Badge variant="secondary" size="sm">
                <Icon name="Lock" size={12} className="mr-1" />
                Private
              </Badge>
            }
            actions={
              <Button variant="outline" size="sm">
                <Icon name="Settings" size={14} className="mr-1.5" />
                Settings
              </Button>
            }
            className="mb-0"
          >
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
              <span className="flex items-center gap-1">
                <Icon name="Users" size={14} />
                12 members
              </span>
              <span className="flex items-center gap-1">
                <Icon name="FileText" size={14} />
                48 pages
              </span>
            </div>
          </PageHeader>
        </div>
      </StateDemo>

      <CollapsibleDocs type="usage">
        <DocsCodeBlock label="Import">
{`import { PageHeader } from '@/components/ui/PageHeader';`}
        </DocsCodeBlock>

        <DocsCodeBlock label="Page Structure (always wrap in NavPageLayout)">
{`import NavPageLayout from '@/components/layout/NavPageLayout';
import { PageHeader } from '@/components/ui/PageHeader';

export default function MyPage() {
  return (
    <NavPageLayout>
      <PageHeader title="My Page" />
      {/* page content */}
    </NavPageLayout>
  );
}`}
        </DocsCodeBlock>

        <DocsCodeBlock label="With Description">
{`<PageHeader
  title="Recently Viewed"
  description="Pages you've viewed recently"
/>`}
        </DocsCodeBlock>

        <DocsCodeBlock label="With Back Button">
{`// Uses router.back()
<PageHeader title="Settings" backHref={true} />

// Navigates to specific URL
<PageHeader title="Settings" backHref="/groups" />`}
        </DocsCodeBlock>

        <DocsCodeBlock label="With Actions and Children">
{`<PageHeader
  title="Random Pages"
  actions={<Button>Shuffle</Button>}
>
  <div className="mt-4">
    {/* Additional content below the header */}
  </div>
</PageHeader>`}
        </DocsCodeBlock>
      </CollapsibleDocs>

      <CollapsibleDocs type="props">
        <div className="space-y-2 text-sm w-full">
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">title: string</code>
            <span className="text-muted-foreground">- Required. Page heading text</span>
          </div>
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">description?: string</code>
            <span className="text-muted-foreground">- Subtitle below the title</span>
          </div>
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">icon?: IconName</code>
            <span className="text-muted-foreground">- Icon displayed before the title</span>
          </div>
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">iconClassName?: string</code>
            <span className="text-muted-foreground">- CSS classes for the icon</span>
          </div>
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">{'backHref?: boolean | string'}</code>
            <span className="text-muted-foreground">- Back button (true = router.back(), string = push URL)</span>
          </div>
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">actions?: ReactNode</code>
            <span className="text-muted-foreground">- Right-aligned buttons/controls</span>
          </div>
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">badges?: ReactNode</code>
            <span className="text-muted-foreground">- Inline badges after the title</span>
          </div>
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">children?: ReactNode</code>
            <span className="text-muted-foreground">- Content below the title row (meta info, tabs)</span>
          </div>
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">className?: string</code>
            <span className="text-muted-foreground">- Override wrapper classes (default: mb-6)</span>
          </div>
        </div>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
