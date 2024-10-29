"use client"

import LinkButton from "@/components/button/link";
import Layout from "@/components/layout/Layout";
import { AppContext } from "@/providers/AppProvider";
import { AuthContext } from "@/providers/AuthProvider";
import { DataContext } from "@/providers/DataProvider";
import { useRouter } from "next/navigation";
import { useContext, useEffect } from "react";

export default function Home() {

  const { loading, setLoading } = useContext(AppContext)
  const { user } = useContext(AuthContext)
  const router = useRouter();
  const { pages, loadMorePages, isMoreLoading, hasMorePages } = useContext(DataContext);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading]);

  if (loading || !user) {
    return null;
  }
  return (
    <Layout>
      <div>
        <p>My pages</p>
        <div className="mt-4">
          <div>
            <ul className="space-x-1 flex flex-wrap">
              {pages?.map((page: any, index: number) => {
                return (
                  <li key={page.id}>
                    <LinkButton
                      // groupId={page.groupId}
                      href={`/pages/${page.id}`}
                    // isPublic={page.isPublic}
                    >
                      {page.title}
                    </LinkButton>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="flex justify-center mt-4">
            {
              hasMorePages && (
                <button
                  className="bg-primary text-white px-4 py-2 rounded-full"
                  onClick={() => loadMorePages(user.uid)}
                  disabled={isMoreLoading}
                >
                  {isMoreLoading ? "Loading..." : "Load more"}
                </button>
              )
            }
          </div>
        </div>
      </div>
    </Layout>
  );
}
