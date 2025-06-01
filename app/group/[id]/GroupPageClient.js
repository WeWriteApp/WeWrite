"use client";

import React from "react";
import GroupProfileView from "../../components/groups/GroupProfileView";
import { PageProvider } from "../../contexts/PageContext";
import { LineSettingsProvider } from "../../contexts/LineSettingsContext";

export default function GroupPageClient({ group }) {
  return (
    <PageProvider>
      <LineSettingsProvider>
        <GroupProfileView group={group} />
      </LineSettingsProvider>
    </PageProvider>
  );
}
