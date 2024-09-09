"use client";
import React, { useState, useEffect, useContext } from "react";
import { rtdb } from '../../firebase/rtdb'
import { onValue, ref, set } from "firebase/database";
import { ReactSearchAutocomplete } from "react-search-autocomplete";
import { AuthContext } from "../../providers/AuthProvider";
import Profile from "../../components/ProfileBadge";

export default function Page({ params }) {
  const [group, setGroup] = useState(null);

  useEffect(() => {
    if (!params.id) return;
    const groupRef = ref(rtdb, `groups/${params.id}`);
    return onValue(groupRef, (snapshot) => {
      setGroup({
        id: snapshot.key,
        ...snapshot.val()
      });
    });
  }, [params]);

  const handleRemoveGroup = () => {
    const groupRef = ref(rtdb, `groups/${params.id}`);
    set(groupRef, null);
  }

  if (!group) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <h1
        className="text-3xl font-semibold"
      >{group.name}</h1>
      <p>{group.description}</p>
      {
        group.members && (
          <Members members={group.members} groupId={group.id} />
        )
      }


    </div>
  );
}

const Members = ({ members, groupId }) => {
  const {user } = useContext(AuthContext)

  const handleRemove = (uid) => {
    let newMembers = {...members};
    delete newMembers[uid];
    const groupMembersRef = ref(rtdb, `groups/${groupId}/members`);
    set(groupMembersRef, newMembers);
  }
  return (
    <div className="mt-4">
      <h2
        className="text-lg font-semibold"
      >Members</h2>
      <ul>
        {Object.entries(members).map(([uid, member]) => (
          <li
            key={uid}
            className="flex items-center space-x-2"
          >
            <Profile uid={uid} />
            <span>{member.role}</span>
            {
              members[user.uid] && members[user.uid].role === "owner" &&
              member.role !== "owner" && 
                <button
                  className="text-red-500"
                  type="button"
                  onClick={() => handleRemove(uid)}
                >Remove</button>
              
            }
          </li>
        ))}
      </ul>
        {
          members[user.uid] && members[user.uid].role === "owner" && (
            <AddMembersForm groupId={groupId} initialMembers={members} />
          )
        }
    </div>
  );
}

const AddMembersForm = ({ groupId,initialMembers }) => {
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (users.length) return;
    const usersRef = ref(rtdb, 'users');
    let arr = [];
    return onValue(usersRef, (snapshot) => {
      snapshot.forEach((child) => {
        arr.push({
          id: child.key,
          name: child.val().username
        });
      });
      setUsers(arr);
    });
    
  }, []);

  useEffect(() => {
    if (!initialMembers) return;
    setMembers(initialMembers);
  }, [initialMembers]);

  const handleSelect = (user) => {
    let memberdata = {}
    memberdata[user.id] = {
      role: "member",
      joinedAt: new Date().toISOString()
    }
    
    setMembers(
      members => {
        return {
          ...members,
          ...memberdata
        }
      }
    )
    setSearch("");
  }

  const handleSave = () => {
    // save member
    let membersArr = [];

    // groups/{groupId}/members/{uid}
    Object.entries(members).forEach(([uid, member]) => {
      membersArr[uid] = member;
    });

    // save to group
    const groupMembersRef = ref(rtdb, `groups/${groupId}/members`);
    set(groupMembersRef, membersArr);
  }

  if (!users.length) return <div>Loading...</div>;
  return (
    <div className="mt-4">
      <h2
        className="text-lg font-semibold"
      >Add Members</h2>
      <ReactSearchAutocomplete
        items={users}
        inputSearchString={search}
        onSearch={setSearch}
        onSelect={handleSelect}
        autoFocus
        placeholder="Search for a user"
        fuseOptions={{ 
          minMatchCharLength: 2,
        }}
        formatResult={(item) => {
          return (
            <div key={item.id}>
              {item.name}
            </div>
          );
        }}
      />
      {
        members && (
          <pre>{JSON.stringify(members, null, 2)}</pre>
        )
      }
      {
        members && (
          <button
            className="bg-white w-auto inline-block text-black px-4 py-2 rounded-lg border border-gray-500 hover:bg-gray-500 hover:text-white mt-4"
            type="button"
            onClick={handleSave}
          >Add Members</button>
        )
      }
    </div>
  );
}