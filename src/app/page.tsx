"use client"

import LinkButton from "@/components/button/link";
import Layout from "@/components/layout/Layout";
import TotalSearch from "@/components/search/TotalSearch";
import { AppContext } from "@/providers/AppProvider";
import { AuthContext } from "@/providers/AuthProvider";
import { DataContext } from "@/providers/DataProvider";
import { faPlus, faSearch, faUser, faFile } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Input, NavbarItem } from "@nextui-org/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContext, useEffect } from "react";

export default function Home() {

  const { loading, setLoading } = useContext(AppContext)
  const { user } = useContext(AuthContext)
  const router = useRouter();
  const { pages, groups, loadMorePages, isMoreLoading, hasMorePages } = useContext(DataContext);

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
      <div className="">
        <TotalSearch />
        <div className="flex flex-col border rounded-2xl border-white/25 p-2 mt-4">
          <div className="flex justify-between items-center">
            <p className="font-bold">My pages</p>
            <Link href="/pages/new">
              <div className="flex items-center gap-[10px] px-[10px] py-[8px] border border-white/30 bg-white/10 hover:bg-white/25 hover:scale-101 active:scale-99 rounded-xl font-medium cursor-pointer">
                <FontAwesomeIcon icon={faPlus} />
              </div>
            </Link>
          </div>
          <div className="mt-4">
            <div>
              <div className="flex flex-wrap gap-2">
                {pages?.map((page: any, index: number) => {
                  return (
                    <div key={page.id} className="flex">
                      <LinkButton
                        // groupId={page.groupId}
                        href={`/pages/${page.id}`}
                      // isPublic={page.isPublic}
                      >
                        {page.title}
                      </LinkButton>
                    </div>
                  );
                })}
              </div>
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
        <div className="flex flex-col border rounded-2xl border-white/25 p-2 mt-4">
          <div className="flex justify-between items-center">
            <p className="font-bold">My groups</p>
            <Link href="/group/new">
              <div className="flex items-center gap-[10px] px-[10px] py-[8px] border border-white/30 bg-white/10 hover:bg-white/25 hover:scale-101 active:scale-99 rounded-xl font-medium cursor-pointer">
                <FontAwesomeIcon icon={faPlus} />
              </div>
            </Link>
          </div>
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              {groups?.map((group: any) => (
                <Link 
                  key={group.id} 
                  href={`/groups/${group.id}`}
                  className="flex-1 min-w-[200px] max-w-[300px] p-4 border border-white/30 rounded-xl bg-white/10 hover:bg-white/25 transition-all"
                >
                  <div className="font-medium mb-2">{group.name}</div>
                  <div className="flex gap-4 text-sm text-white/70">
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon icon={faUser} />
                      <span>{group.memberCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon icon={faFile} />
                      <span>{group.pageCount || 0}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
