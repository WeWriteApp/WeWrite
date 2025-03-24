"use client";

import React, { useState, useEffect, useContext } from "react";
import { rtdb } from '../firebase/rtdb';
import { onValue, ref, set, get } from "firebase/database";
import { AuthContext } from "../providers/AuthProvider";
import { Button } from "./ui/button";
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
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "./ui/table";

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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Members ({membersList.length})</h3>
        {isOwner && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-1">
                <UserPlus className="h-4 w-4" />
                <span>Add Member</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Member to Group</DialogTitle>
                <DialogDescription>
                  Search for a user by username to add them to this group.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="Search by username..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (e.target.value.length > 2) {
                        const filtered = users.filter(u => 
                          u.username.toLowerCase().includes(e.target.value.toLowerCase()) && 
                          !membersList.some(m => m.id === u.id)
                        );
                        setFilteredUsers(filtered);
                      } else {
                        setFilteredUsers([]);
                      }
                    }}
                  />
                </div>
                {filteredUsers.length > 0 ? (
                  <div className="max-h-[200px] overflow-y-auto border rounded-md">
                    {filteredUsers.map(user => (
                      <div 
                        key={user.id}
                        className={`p-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center ${selectedUser?.id === user.id ? 'bg-gray-100' : ''}`}
                        onClick={() => setSelectedUser(user)}
                      >
                        <span>{user.username}</span>
                        {selectedUser?.id === user.id && <Check className="h-4 w-4 text-green-500" />}
                      </div>
                    ))}
                  </div>
                ) : searchTerm.length > 2 ? (
                  <p className="text-sm text-gray-500">No users found</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleAddMember} 
                  disabled={!selectedUser || isLoading}
                >
                  {isLoading ? 'Adding...' : 'Add Member'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              {isOwner && <TableHead className="w-[80px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {membersList.length > 0 ? (
              membersList.map(member => (
                <TableRow key={member.id}>
                  <TableCell>{member.username}</TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(member.joinedAt).toLocaleDateString()}</TableCell>
                  {isOwner && (
                    <TableCell>
                      {member.role !== 'owner' && (
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
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={isOwner ? 4 : 3} className="h-24 text-center">
                  No members found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
