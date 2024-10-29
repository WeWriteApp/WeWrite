"use client"

import LinkButton from "@/components/button/link";
import Layout from "@/components/layout/Layout";
import { AppContext } from "@/providers/AppProvider";
import { AuthContext } from "@/providers/AuthProvider";
import { DataContext } from "@/providers/DataProvider";
import { faPlus, faSearch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Input, NavbarItem } from "@nextui-org/react";
import Link from "next/link";
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
      <div className="">
        <Input
          type="text"
          isClearable
          placeholder="Search Pages, Users, Groups"
          labelPlacement="outside"
          startContent={
            <FontAwesomeIcon icon={faSearch} />
          }
        />

        <div className="flex justify-between mt-4">
          <p>My pages</p>
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
        <div className="flex justify-between mt-4">
          <p>My groups</p>
          <Link href="/group/new">
            <div className="flex items-center gap-[10px] px-[10px] py-[8px] border border-white/30 bg-white/10 hover:bg-white/25 hover:scale-101 active:scale-99 rounded-xl font-medium cursor-pointer">
              <FontAwesomeIcon icon={faPlus} />
            </div>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
