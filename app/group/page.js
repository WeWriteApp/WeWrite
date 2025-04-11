"use client";

import { useState, useEffect } from "react";
import { getDatabase, ref, get } from "firebase/database";
import { app } from "../firebase/config";
import { useAuth } from "../providers/AuthProvider";
import GroupBadge from "../components/GroupBadge";
import { Button } from "../components/ui/button";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { Loader } from "../components/ui/loader";

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchGroups() {
      try {
        const db = getDatabase(app);
        const groupsRef = ref(db, "groups");
        const snapshot = await get(groupsRef);
        
        if (snapshot.exists()) {
          const groupsData = snapshot.val();
          const groupsArray = Object.entries(groupsData)
            .map(([id, data]) => ({
              id,
              ...data,
              // Only include public groups or groups the user is a member of
              isVisible: !data.isPrivate || (user && data.members && data.members[user.uid])
            }))
            .filter(group => group.isVisible)
            .sort((a, b) => {
              // Sort by groups the user is a member of first, then by name
              const userInA = user && a.members && a.members[user.uid];
              const userInB = user && b.members && b.members[user.uid];
              
              if (userInA && !userInB) return -1;
              if (!userInA && userInB) return 1;
              
              return a.name.localeCompare(b.name);
            });
          
          setGroups(groupsArray);
        } else {
          setGroups([]);
        }
      } catch (error) {
        console.error("Error fetching groups:", error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchGroups();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Groups</h1>
        <Link href="/group/new">
          <Button className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            New Group
          </Button>
        </Link>
      </div>
      
      {groups.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No groups found.</p>
          <p>
            <Link href="/group/new" className="text-primary hover:underline">
              Create a new group
            </Link>{" "}
            to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group, index) => (
            <GroupBadge key={group.id} group={group} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
