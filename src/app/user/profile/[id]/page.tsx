"use client"
import Layout from "@/components/layout/Layout"
import { faFile, faUser, faUsers } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Tabs, Tab, Chip } from "@nextui-org/react";

const ProfilePage = () => {

  return (
    <Layout>
      <div className="flex w-full flex-col">
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
          />
          <Tab
            key="pages"
            title={
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faFile} />
                <span>Pages</span>
                <Chip size="sm" variant="faded">3</Chip>
              </div>
            }
          />
          <Tab
            key="groups"
            title={
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faUsers} />
                <span>Groups</span>
                <Chip size="sm" variant="faded">1</Chip>
              </div>
            }
          />
        </Tabs>
      </div>
    </Layout>
  )
}

export default ProfilePage