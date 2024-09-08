// a page to display a user profile
//
"use client";
import React, { useState, useEffect } from "react";
import { rtdb } from "../../firebase/rtdb";
import { ref, onValue } from "firebase/database";
import { PillLink } from "../../components/PillLink";
import Link from "next/link";
import { ReactSearchAutocomplete } from "react-search-autocomplete";
import { useRouter } from "next/navigation";

const Profile = ({ params }) => {
  const [profile, setProfile] = useState({});
  const [searchItems, setSearchItems] = useState([]);
  const [pages, setPages] = useState([]);
  const [pageCount, setPageCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!params.id) return;
    const profileRef = ref(rtdb, `users/${params.id}`);
    onValue(profileRef, (snapshot) => {

      let user = snapshot.val();

      if (user.pages) {
        let arr = [];
        let searchArr = [];
        Object.keys(user.pages).forEach((key) => {
          if (user.pages[key].isPublic) {
            arr.push({
              id: key,
              ...user.pages[key]
            });

            searchArr.push({
              id: key,
              name: user.pages[key].title,
              isPublic: user.pages[key].isPublic
            });
          }

        });
        setPages(arr);
        setSearchItems(searchArr);
        setPageCount(arr.length);
      }

      setProfile(user);      
    });
  }, [params]);

  return (
    <div className="p-4">
      <Link href="/pages">
        Back
      </Link>
      <h1
        className="text-3xl font-semibold"
      >{profile.username}</h1>
      {
        pages.length > 0 && (
          <div>
            <h2
              className="text-lg font-semibold"
            >Public Pages - {pageCount}</h2>

            <Search pages={searchItems} router={router} />
            <ul className="space-x-1 flex flex-wrap">
              {pages.map((page) => (
                <li key={page.id}>
                  <PillLink href={`/pages/${page.id}`} isPublic={page.isPublic}>
                    {page.title}
                  </PillLink>
                </li>
              ))}
            </ul>
          </div>
        )
      }
      {
        pages.length === 0 && (
          <div>
            <p>This user has no public pages.</p>
          </div>
        )
      }
    </div>
  );
}

const Search = ({
  pages,
  router
}) => {

  const handleOnSearch = (string, results) => {
  };

  const handleOnSelect = (item) => {
    router.push(`/pages/${item.id}`);
  }

  return (
    <div className="p-4 w-full">
      <ReactSearchAutocomplete
        items={pages}
        onSearch={handleOnSearch}
        onSelect={handleOnSelect}
        autoFocus
        placeholder="Search for a page..."
        fuseOptions={{ 
          minMatchCharLength: 2,
        }}
        formatResult={(item) => {
          return (
            <PillLink href={`/pages/${item.id}`} isPublic={item.isPublic} key={item.id}>
              {item.name}
            </PillLink>
          );
        }}
      />
    </div>
  );
};

export default Profile;