"use client";

import React, { useState, useEffect, useContext } from "react";
import { rtdb } from '../firebase/rtdb';
import { onValue, ref, set, get } from "firebase/database";
import { AuthContext } from "../providers/AuthProvider";
import { Button } from "./ui/button";
import { DataTable } from "./ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { MoreHorizontal, Trash2, UserPlus, Check, X } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuTrigger 
} from "./ui/dropdown-menu";

interface Member {
  id: string;
  username: string;
  role: string;
  joinedAt: string;
}

interface User {
  id: string;
  username: string;
}

interface GroupMembersTableProps {
  groupId: string;
  members: Record<string, { role: string; joinedAt: string }>;
  isOwner: boolean;
}

export default function GroupMembersTable({ groupId, members, isOwner }: GroupMembersTableProps) {
  const { user } = useContext(AuthContext);
  const [membersList, setMembersList] = useState<Member[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch member details
  useEffect(() => {
    if (!members) return;

    const fetchMemberDetails = async () => {
      const membersData: Member[] = [];
      
      for (const [uid, memberData] of Object.entries(members)) {
        const userRef = ref(rtdb, `users/${uid}`);
        const snapshot = await get(userRef);
        const userData = snapshot.val();
        
        if (userData) {
          membersData.push({
            id: uid,
            username: userData.username || 'Unknown User',
            role: memberData.role,
            joinedAt: memberData.joinedAt
          });
        }
      }
      
      setMembersList(membersData);
    };
    
    fetchMemberDetails();
  }, [members]);

  // Fetch all users for the add member dialog
  useEffect(() => {
    const usersRef = ref(rtdb, 'users');
    
    return onValue(usersRef, (snapshot) => {
      if (!snapshot.exists()) return;
      
      const usersData: User[] = [];
      snapshot.forEach((childSnapshot) => {
        const userData = childSnapshot.val();
        // Don't include users who are already members
        if (!members[childSnapshot.key!]) {
          usersData.push({
            id: childSnapshot.key!,
            username: userData.username || 'Unknown User'
          });
        }
      });
      
      setUsers(usersData);
    });
  }, [members]);

  // Filter users based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers([]);
      return;
    }
    
    const filtered = users.filter(user => 
      user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    
    try {
      const updatedMembers = { ...members };
      delete updatedMembers[memberId];
      
      const membersRef = ref(rtdb, `groups/${groupId}/members`);
      await set(membersRef, updatedMembers);
    } catch (error) {
      console.error("Error removing member:", error);
      alert("Failed to remove member. Please try again.");
    }
  };

  const handleAddMember = async () => {
    if (!selectedUser) return;
    
    setIsLoading(true);
    try {
      const updatedMembers = { 
        ...members,
        [selectedUser.id]: {
          role: "member",
          joinedAt: new Date().toISOString()
        }
      };
      
      const membersRef = ref(rtdb, `groups/${groupId}/members`);
      await set(membersRef, updatedMembers);
      
      setIsDialogOpen(false);
      setSearchTerm('');
      setSelectedUser(null);
    } catch (error) {
      console.error("Error adding member:", error);
      alert("Failed to add member. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const columns: ColumnDef<Member>[] = [
    {
      accessorKey: "username",
      header: "Username",
      cell: ({ row }) => <div>{row.original.username}</div>,
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant={row.original.role === "owner" ? "default" : "outline"}>
          {row.original.role.charAt(0).toUpperCase() + row.original.role.slice(1)}
        </Badge>
      ),
    },
    {
      accessorKey: "joinedAt",
      header: "Joined",
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {new Date(row.original.joinedAt).toLocaleDateString()}
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const member = row.original;
        
        // Don't show actions for owner or if current user is not the owner
        if (member.role === "owner" || !isOwner) {
          return null;
        }
        
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => handleRemoveMember(member.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove member
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Members</h2>
        {isOwner && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a new member</DialogTitle>
                <DialogDescription>
                  Search for a user to add to this group. Members can view and edit all pages in the group.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="Search by username..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                {searchTerm.trim() !== '' && (
                  <div className="max-h-[200px] overflow-y-auto border rounded-md">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map(user => (
                        <div
                          key={user.id}
                          className={`p-2 cursor-pointer hover:bg-muted flex justify-between items-center ${
                            selectedUser?.id === user.id ? 'bg-muted' : ''
                          }`}
                          onClick={() => setSelectedUser(user)}
                        >
                          <span>{user.username}</span>
                          {selectedUser?.id === user.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-2 text-muted-foreground">No users found</div>
                    )}
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsDialogOpen(false);
                  setSearchTerm('');
                  setSelectedUser(null);
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddMember} 
                  disabled={!selectedUser || isLoading}
                >
                  {isLoading ? "Adding..." : "Add Member"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      <DataTable
        columns={columns}
        data={membersList}
      />
    </div>
  );
}
