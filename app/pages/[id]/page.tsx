"use client";

import * as React from "react";
import PageHeader from "../../components/PageHeader";
import SinglePageView from "../../components/SinglePageView";
import { getPageById } from "../../firebase/database";
import { AuthContext } from "../../providers/AuthProvider";
import { useRouter } from "next/navigation";
import { rtdb } from "../../firebase/rtdb";
import { ref, get } from "firebase/database";

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
  const [pageOwnerUsername, setPageOwnerUsername] = React.useState<string>('Anonymous');
  const { user } = React.useContext(AuthContext);
  const router = useRouter();

  React.useEffect(() => {
    const loadPage = async () => {
      const { pageData } = await getPageById(params.id);
      setPage(pageData as PageData);

      // Fetch page owner's username
      if (pageData?.userId) {
        const userRef = ref(rtdb, `users/${pageData.userId}`);
        const userSnapshot = await get(userRef);
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          setPageOwnerUsername(userData.username || 'Anonymous');
        }
      }
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
        username={pageOwnerUsername}
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