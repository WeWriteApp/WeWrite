"use client"
import LinkButton from "@/components/button/link";
import Layout from "@/components/layout/Layout"
import { fetchProfileFromFirebase } from "@/firebase/rtdb";
import usePages from "@/hooks/usePages";
import { User } from "@/providers/AuthProvider";
import { faFile, faUser, faUsers } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Tabs, Tab, Chip } from "@nextui-org/react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const ProfilePage = () => {

  const params = useParams()
  const [userData, setUserData] = useState<User>()
  const { pages, loading, loadMorePages, isMoreLoading, hasMorePages, setLoading } = usePages(params?.id as string)

  useEffect(() => {
    const fetch = async () => {
      if (params?.id) {
        const user = await fetchProfileFromFirebase(Array.isArray(params?.id) ? params?.id[0] : params?.id);
        setUserData(user)
      }
    }
    fetch()
  }, [])

  return (
    <Layout>
      <div className="flex w-full flex-col">
        <div>
          <p>{userData?.username}</p>
        </div>
        <Tabs
          aria-label="Options"
          color="primary"
          variant="underlined"
          classNames={{
            tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
            cursor: "w-full bg-primary",
            tab: "max-w-fit px-0 h-12",
            tabContent: "group-data-[selected=true]:text-text"
          }}
        >
          <Tab
            key="bio"
            title={
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faUser} />
                <span>Bio</span>
              </div>
            }
          >
            {!userData?.bio ? <div className="rounded-xl border border-white/25 p-4">
              <span className="text-primary font-bold">{userData?.username}</span> hasn’t written a bio page yet.
              <br /><br />
              Check back later!
            </div> :
              <div>

              </div>}

          </Tab>
          <Tab
            key="pages"
            title={
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faFile} />
                <span>Pages</span>
                {pages && pages.length > 0 && <Chip size="sm" variant="faded">{pages.length}</Chip>}
              </div>
            }
          >
            <div className="flex flex-wrap gap-2">
              {pages.map((item: any, idx: any) => (
                item.isPublic && <LinkButton href={`/pages/${item.id}`} key={idx}>{item.title}</LinkButton>
              ))}
            </div>
          </Tab>
          <Tab
            key="groups"
            title={
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faUsers} />
                <span>Groups</span>
                {Object.keys(userData?.groups).length > 0 && <Chip size="sm" variant="faded">{Object.keys(userData?.groups).length}</Chip>}
              </div>
            }
          />
        </Tabs>
      </div>
    </Layout>
  )
}

export default ProfilePage