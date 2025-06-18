/**
 * WeWrite Group Members Management Component
 *
 * This component provides comprehensive group member management functionality with
 * an invitation-based system that replaces direct member addition. It implements
 * user consent requirements and proper role-based access controls.
 *
 * Key Features:
 * - Invitation-based member addition (replaces direct addition)
 * - Role-based permissions (owner, admin, member)
 * - Member search and filtering capabilities
 * - Leave group functionality for non-owners
 * - Responsive design with desktop table and mobile card views
 *
 * Group Invitation System:
 * - Sends invitation notifications instead of directly adding members
 * - Users must accept invitations to join groups
 * - Prevents duplicate invitations to the same user
 * - Provides clear feedback on invitation status
 *
 * Database Integration:
 * - Uses Firebase Realtime Database for group member data
 * - Uses Firestore for user search and profile information
 * - Implements proper error handling and data validation
 *
 * Security Features:
 * - Only group owners can invite new members
 * - Members can leave groups (except owners)
 * - Proper authentication checks before operations
 *
 * UI/UX Features:
 * - Responsive design with separate desktop/mobile layouts
 * - Real-time member list updates
 * - Interactive search with live filtering
 * - Toast notifications for user feedback
 * - Confirmation dialogs for destructive actions
 *
 * @author WeWrite Development Team
 * @version 2.0.0 - Invitation System Implementation
 */

"use client";

import React, { useState, useEffect, useContext } from "react";
import { rtdb } from "../../firebase/rtdb";
import { onValue, ref, set, get } from "firebase/database";
import { AuthContext } from "../../providers/AuthProvider";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { MoreHorizontal, Trash2, UserPlus, Check, X, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "../ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../ui/table";
import { toast } from "../ui/use-toast";
import { useRouter } from "next/navigation";

/**
 * Member data interface for group member display
 */
interface Member {
  id: string;
  username: string;
  role: string;        // 'owner', 'admin', or 'member'
  joinedAt: string;    // ISO date string
}

/**
 * User data interface for search and invitation functionality
 */
interface User {
  id: string;
  username: string;
}

/**
 * Props interface for GroupMembersTable component
 */
interface GroupMembersTableProps {
  groupId: string;                                              // Unique group identifier
  members: Record<string, { role: string; joinedAt: string }>; // Current group members
  isOwner: boolean;                                             // Whether current user is group owner
}

export default function GroupMembersTable({ groupId, members, isOwner }: GroupMembersTableProps) {
  const { user } = useContext(AuthContext);
  const router = useRouter();
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
      const usersRef = ref(rtdb, 'users');
      const usersSnapshot = await get(usersRef);

      if (!usersSnapshot.exists()) return;

      const usersData = usersSnapshot.val();
      const membersArray: Member[] = [];
      const usersArray: User[] = [];

      // First collect all users
      Object.keys(usersData).forEach(userId => {
        usersArray.push({
          id: userId,
          username: usersData[userId].username || 'Unknown User'
        });
      });

      // Then map members with their details
      Object.keys(members).forEach(memberId => {
        const memberData = members[memberId];
        const userData = usersData[memberId];

        if (userData) {
          membersArray.push({
            id: memberId,
            username: userData.username || 'Unknown User',
            role: memberData.role,
            joinedAt: memberData.joinedAt
          });
        }
      });

      setMembersList(membersArray);
      setUsers(usersArray);
    };

    fetchMemberDetails();
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
      toast.error("Failed to remove member. Please try again.");
    }
  };

  const handleLeaveGroup = async () => {
    if (!user?.uid) return;
    if (!confirm("Are you sure you want to leave this group?")) return;

    try {
      const updatedMembers = { ...members };
      delete updatedMembers[user.uid];

      const membersRef = ref(rtdb, `groups/${groupId}/members`);
      await set(membersRef, updatedMembers);

      // Redirect to groups page
      router.push("/groups");
    } catch (error) {
      console.error("Error leaving group:", error);
      toast.error("Failed to leave group. Please try again.");
    }
  };

  /**
   * Handle adding a new member to the group via invitation system
   *
   * This function implements the invitation-based member addition system that
   * replaces direct member addition. Instead of immediately adding users to
   * the group, it sends them an invitation notification that they must accept.
   *
   * Process:
   * 1. Validates selected user and authentication
   * 2. Fetches group information for invitation context
   * 3. Creates group invitation notification
   * 4. Provides user feedback and resets form state
   *
   * Benefits of invitation system:
   * - Requires user consent before joining groups
   * - Prevents unwanted group additions
   * - Provides clear audit trail of invitations
   * - Allows users to reject unwanted invitations
   *
   * Error Handling:
   * - Validates user authentication
   * - Checks group existence
   * - Handles notification creation failures
   * - Provides user-friendly error messages
   */
  const handleAddMember = async () => {
    if (!selectedUser) return;

    setIsLoading(true);
    try {
      // Get group information for invitation context
      const groupRef = ref(rtdb, `groups/${groupId}`);
      const groupSnapshot = await get(groupRef);

      if (!groupSnapshot.exists()) {
        throw new Error("Group not found");
      }

      const groupData = groupSnapshot.val();
      const groupName = groupData.name || "Unknown Group";

      // Validate user authentication
      if (!user?.uid) {
        throw new Error("User not authenticated");
      }

      // Send group invitation instead of directly adding member
      // This implements the consent-based invitation system
      const { createGroupInviteNotification } = await import('../../firebase/notifications');
      await createGroupInviteNotification(
        selectedUser.id,    // Target user to invite
        user.uid,           // Current user sending invitation
        groupId,            // Group to invite to
        groupName           // Group name for notification context
      );

      // Reset form state
      setIsDialogOpen(false);
      setSearchTerm('');
      setSelectedUser(null);
    } catch (error) {
      console.error("Error sending group invitation:", error);
      toast.error("Failed to send invitation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Members ({membersList.length})</h3>
        <div className="flex gap-2">
          {!isOwner && user?.uid && members[user.uid] && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLeaveGroup}
              className="flex items-center gap-1 text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Leave Group</span>
            </Button>
          )}
          {isOwner && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center gap-1">
                  <UserPlus className="h-4 w-4" />
                  <span>Invite Member</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Member to Group</DialogTitle>
                  <DialogDescription>
                    Search for a user by username to send them a group invitation.
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
                    {isLoading ? 'Sending...' : 'Send Invitation'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-2xl border border-theme-medium shadow-md dark:bg-card/90 dark:hover:bg-card/100 overflow-hidden">
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

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {membersList.length > 0 ? (
          membersList.map(member => (
            <div key={member.id} className="wewrite-card">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium text-foreground">{member.username}</h3>
                    <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </p>
                </div>
                {isOwner && member.role !== 'owner' && (
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
              </div>
            </div>
          ))
        ) : (
          <div className="wewrite-card text-center py-8">
            <p className="text-muted-foreground">No members found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
