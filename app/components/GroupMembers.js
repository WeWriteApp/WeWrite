"use client";
import React, { useState, useEffect, useContext } from "react";
import { getFirebase } from '../firebase/config';
import { onValue, ref, set } from "../firebase/rtdb";
import { ReactSearchAutocomplete } from "react-search-autocomplete";
import { AuthContext } from "../providers/AuthProvider";
import User from "./UserBadge";

const GroupMembers = ({ members, groupId }) => {
  const { user } = useContext(AuthContext);

  const handleRemove = async (uid) => {
    let newMembers = { ...members };
    delete newMembers[uid];
    const { rtdb } = await getFirebase();
    const groupMembersRef = ref(rtdb, `groups/${groupId}/members`);
    await set(groupMembersRef, newMembers);
  };

  return (
    <div className="mt-4">
      <h2 className="text-lg font-semibold">Members</h2>
      <ul>
        {Object.entries(members).map(([uid, member]) => (
          <li key={uid} className="flex items-center space-x-2">
            <User uid={uid} />
            <span>{member.role}</span>
            {members && user && members[user.uid] && members[user.uid].role === "owner" && member.role !== "owner" && (
              <button className="text-red-500" type="button" onClick={() => handleRemove(uid)}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {members && user && members[user.uid] && members[user.uid].role === "owner" && (
        <AddMembersForm groupId={groupId} initialMembers={members} />
      )}
    </div>
  );
};

const AddMembersForm = ({ groupId, initialMembers }) => {
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (users.length) return;
    const fetchUsers = async () => {
      const { rtdb } = await getFirebase();
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
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!initialMembers) return;
    setMembers(initialMembers);
  }, [initialMembers]);

  const handleSelect = (user) => {
    let memberdata = {};
    memberdata[user.id] = {
      role: "member",
      joinedAt: new Date().toISOString()
    };

    setMembers((members) => {
      return {
        ...members,
        ...memberdata
      };
    });
    setSearch("");
  };

  const handleSave = async () => {
    let membersArr = [];

    Object.entries(members).forEach(([uid, member]) => {
      membersArr[uid] = member;
    });

    const { rtdb } = await getFirebase();
    const groupMembersRef = ref(rtdb, `groups/${groupId}/members`);
    await set(groupMembersRef, membersArr);
  };

  if (!users.length) return <div>Loading...</div>;
  return (
    <div className="mt-4">
      <h2 className="text-lg font-semibold">Add Members</h2>
      <ReactSearchAutocomplete
        items={users}
        inputSearchString={search}
        onSearch={setSearch}
        onSelect={handleSelect}
        autoFocus
        className="searchbar"
        placeholder="Search for a user"
        fuseOptions={{
          minMatchCharLength: 2,
        }}
        formatResult={(item) => {
          return <div key={item.id}>{item.name}</div>;
        }}
      />
      {members && (
        <button
          className="bg-background w-auto inline-block text-button-text px-4 py-2 rounded-lg border border-gray-500 hover:bg-gray-500 hover:text-white mt-4"
          type="button"
          onClick={handleSave}
        >
          Add Members
        </button>
      )}
    </div>
  );
};

export default GroupMembers;
