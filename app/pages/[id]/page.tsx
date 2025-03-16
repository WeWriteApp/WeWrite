"use client";

import * as React from "react";
import PageHeader from "../../components/PageHeader";
import SinglePageView from "../../components/SinglePageView";
import { getPageById } from "../../firebase/database";
import { AuthContext } from "../../providers/AuthProvider";
import { useRouter } from "next/navigation";

interface PageProps {
  params: {
    id: string;
  };
}

interface PageData {
  id: string;
  title: string;
  userId: string;
  groupId: string | null;
  isPublic: boolean;
  username?: string;
}

export default function Page({ params }: PageProps) {
  const [page, setPage] = React.useState<PageData | null>(null);
  const [userGroups, setUserGroups] = React.useState<Array<{ id: string; name: string }>>([]);
  const { user } = React.useContext(AuthContext);
  const router = useRouter();

  React.useEffect(() => {
    const loadPage = async () => {
      const { pageData } = await getPageById(params.id);
      setPage(pageData as PageData);
    };
    loadPage();
  }, [params.id]);

  if (!page) {
    return null;
  }

  return (
    <>
      <PageHeader
        title={page.title}
        username={page.username || 'Anonymous'}
        userGroups={userGroups}
        currentGroupId={page.groupId}
        onGroupChange={(groupId) => {
          // Handle group change
        }}
        isPublic={page.isPublic}
        onPrivacyChange={(isPublic) => {
          // Handle privacy change
        }}
      />
      <SinglePageView params={params} />
    </>
  );
} 