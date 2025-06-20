"use client";

import React from "react";
import GroupProfileView from "../../components/groups/GroupProfileView";
import { PageProvider } from "../../contexts/PageContext";

export default function GroupPageClient({ group }) {
  return (
    <PageProvider>
      <GroupProfileView group={group} />
    </PageProvider>
  );
}
