'use client'

import { faSearch, faUser, faUserAlt } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Button, Input, Spinner } from "@nextui-org/react"
import { useEffect, useState } from "react"
import axios from 'axios'
import { useSearch } from "@/hooks/useSearch"
import LinkButton from "../button/link"
import toast from "react-hot-toast"
import { useUsers } from "@/hooks/useUsers"
import UserLink from "../button/userLink"
const TotalSearch = () => {
  const { results, loading, error, search, clear } = useSearch();
  const { users, loading: userLoading, userSearch, clear: userClear } = useUsers()
  const [keyword, setKeyword] = useState("")

  const handleSearch = async () => {
    if (!keyword || keyword.length === 0) {
      toast('Keyword required. Please input keyword to search',
        {
          icon: '👀',
          style: {
            borderRadius: '10px',
            background: '#333',
            color: '#fff',
          },
        })
    }
    search(keyword);
    userSearch(keyword);
  }

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent default form submission if in a form
      handleSearch(); // Call the search function with the current query
    }
  };

  useEffect(() => {
    if (!keyword || keyword.length === 0) {
      clear()
      userClear()
    }
  }, [keyword])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <Input
          value={keyword}
          onValueChange={setKeyword}
          type="text"
          isClearable
          placeholder="Search Pages, Users, Groups"
          labelPlacement="outside"
          onKeyDown={handleKeyDown}
          startContent={
            <FontAwesomeIcon icon={faSearch} />
          }
        />
        <Button onClick={() => handleSearch()} color="primary">
          Search
        </Button>
      </div>
      <div className={`flex flex-col border border-white/25 p-2 rounded-xl ${results.length === 0 && !loading && users.length === 0 && !userLoading ? "hidden" : ""} `}>
        <p>Search Result</p>
        <div className={`flex flex-col rounded-xl border-l-2 border-white/25 p-2 mt-4 gap-4 ${results.length === 0 && !loading ? "hidden" : ""}`}>
          <p>Pages</p>
          <div className="flex flex-wrap gap-4 ">
            {loading ? <Spinner />
              :
              results.map((item, idx) => (
                <LinkButton href={`/pages/${item.document_id}`} key={idx}>
                  {item.title}
                </LinkButton>
              ))}

          </div>
        </div>

        <div className={`flex flex-col border-l-2 rounded-xl border-white/25 p-2 mt-4 gap-4  ${users.length === 0 && !userLoading ? "hidden" : ""}`}>
          <p>Users</p>
          <div className="flex flex-wrap gap-4 ">
            {
              userLoading ? <Spinner /> :
                users.length === 0 ? <p>No user found</p> :
                  users.map((item, idx) => (
                    <UserLink user={item} key={idx} />))
            }
          </div>
        </div>
      </div>
    </div>

  )
}

export default TotalSearch