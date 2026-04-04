"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { AdaptiveModal } from '../../components/ui/adaptive-modal';
import { ComponentShowcase, StateDemo } from './shared';

// Mock group type for demo
interface MockGroup {
  id: string;
  name: string;
  visibility: 'public' | 'private';
}

const MOCK_GROUPS: MockGroup[] = [
  { id: '1', name: 'Philosophy Club', visibility: 'public' },
  { id: '2', name: 'Science Writers', visibility: 'public' },
  { id: '3', name: 'Private Journal', visibility: 'private' },
  { id: '4', name: 'History Buffs', visibility: 'public' },
];

function GroupPickerDemo({ 
  initialGroupId, 
  initialGroupName, 
  canEdit, 
  label 
}: { 
  initialGroupId: string | null; 
  initialGroupName: string | null; 
  canEdit: boolean;
  label: string;
}) {
  const [groupId, setGroupId] = useState<string | null>(initialGroupId);
  const [groupName, setGroupName] = useState<string | null>(initialGroupName);
  const [showPicker, setShowPicker] = useState(false);

  const handleAssign = (group: MockGroup) => {
    setGroupId(group.id);
    setGroupName(group.name);
    setShowPicker(false);
  };

  const handleRemove = () => {
    setGroupId(null);
    setGroupName(null);
    setShowPicker(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">by <span className="font-medium text-foreground">username</span></span>
        <>
          {groupId && groupName ? (
            canEdit ? (
              <button
                onClick={() => setShowPicker(true)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              >
                <span className="whitespace-nowrap">in</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors">
                  <Icon name="Users" size={12} />
                  {groupName}
                  <Icon name="ChevronDown" size={10} />
                </span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span className="whitespace-nowrap">in</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Icon name="Users" size={12} />
                  {groupName}
                </span>
              </span>
            )
          ) : canEdit ? (
            <button
              onClick={() => setShowPicker(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <Icon name="Users" size={12} />
              No group
              <Icon name="ChevronDown" size={10} />
            </button>
          ) : null}

          <AdaptiveModal
            isOpen={showPicker && canEdit}
            onClose={() => setShowPicker(false)}
            title={groupId ? 'Change group' : 'Add to group'}
            subtitle="Select a group to assign this page to"
          >
            <div className="flex flex-col gap-1">
              {MOCK_GROUPS.filter(g => g.id !== groupId).map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleAssign(group)}
                  className="w-full text-left px-4 py-3 rounded-lg text-sm hover:bg-muted transition-colors flex items-center gap-3"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/10 shrink-0">
                    <Icon name="Users" size={16} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="truncate font-medium">{group.name}</span>
                  {group.visibility === 'private' && (
                    <Icon name="Lock" size={12} className="text-muted-foreground shrink-0 ml-auto" />
                  )}
                </button>
              ))}
              {groupId && (
                <button
                  onClick={handleRemove}
                  className="w-full text-left px-4 py-3 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-3 mt-2 border-t border-border pt-4"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-destructive/10 shrink-0">
                    <Icon name="X" size={16} className="text-destructive" />
                  </div>
                  <span className="font-medium">Remove from group</span>
                </button>
              )}
            </div>
          </AdaptiveModal>
        </>
      </div>
    </div>
  );
}

export function GroupSelectorSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Group Selector"
      path="app/components/pages/ContentPageHeader.tsx"
      description="Inline group picker for assigning pages to groups. Shows 'No group' when unassigned, or the group name as an indigo badge when assigned. Owners can click to open a dropdown to change or remove the group. Read-only viewers see a static badge. Gated behind the 'groups' feature flag."
    >
      <StateDemo label="Owner — No Group Assigned (click to assign)">
        <GroupPickerDemo
          initialGroupId={null}
          initialGroupName={null}
          canEdit={true}
          label="Editable, unassigned"
        />
      </StateDemo>

      <StateDemo label="Owner — Group Assigned (click to change/remove)">
        <GroupPickerDemo
          initialGroupId="1"
          initialGroupName="Philosophy Club"
          canEdit={true}
          label="Editable, assigned"
        />
      </StateDemo>

      <StateDemo label="Viewer — Group Assigned (read-only)">
        <GroupPickerDemo
          initialGroupId="2"
          initialGroupName="Science Writers"
          canEdit={false}
          label="Read-only, assigned"
        />
      </StateDemo>

      <StateDemo label="Viewer — No Group (nothing shown)">
        <GroupPickerDemo
          initialGroupId={null}
          initialGroupName={null}
          canEdit={false}
          label="Read-only, unassigned — no UI rendered"
        />
      </StateDemo>
    </ComponentShowcase>
  );
}
