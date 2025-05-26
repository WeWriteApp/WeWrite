"use client";
import React, { useState, useEffect, useContext } from "react";
import { Button } from "./ui/button";
import { UserPlus, Search, Loader, MoreHorizontal, Shield, User, Clock, Check, X, Activity } from "lucide-react";
import { Input } from "./ui/input";
import { rtdb } from "../firebase/rtdb";
import { ref, get, set, update } from "firebase/database";
import { AuthContext } from "../providers/AuthProvider";
import { toast } from "./ui/use-toast";
import { Badge } from "./ui/badge";
import { PillLink } from "./PillLink";
import SimpleSparkline from "./SimpleSparkline";
import { getBatchGroupUserActivityLast24Hours } from "../firebase/userActivity";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "./ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "./ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

export default function GroupMembersTab({ group, isOwner }) {
  const { user } = useContext(AuthContext);
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [memberActivityData, setMemberActivityData] = useState({});
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  // Load members from the group
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setIsLoading(true);

        if (!group.members) {
          setMembers([]);
          setFilteredMembers([]);
          setIsLoading(false);
          return;
        }

        // Transform members object into array with user details
        const membersArray = await Promise.all(
          Object.entries(group.members).map(async ([userId, memberData]) => {
            try {
              const userRef = ref(rtdb, `users/${userId}`);
              const snapshot = await get(userRef);

              if (snapshot.exists()) {
                return {
                  id: userId,
                  ...snapshot.val(),
                  role: memberData.role,
                  joinedAt: memberData.joinedAt
                };
              }
              return {
                id: userId,
                username: "Unknown User",
                role: memberData.role,
                joinedAt: memberData.joinedAt
              };
            } catch (err) {
              console.error(`Error fetching user ${userId}:`, err);
              return {
                id: userId,
                username: "Unknown User",
                role: memberData.role,
                joinedAt: memberData.joinedAt
              };
            }
          })
        );

        setMembers(membersArray);
        setFilteredMembers(membersArray);
      } catch (err) {
        console.error("Error fetching group members:", err);
        setError("Failed to load group members. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [group.id, group.members, refreshKey]);

  // Filter members when search term changes
  useEffect(() => {
    if (!members.length) return;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const filtered = members.filter(member =>
        (member.username && member.username.toLowerCase().includes(term)) ||
        (member.email && member.email.toLowerCase().includes(term)) ||
        (member.role && member.role.toLowerCase().includes(term))
      );
      setFilteredMembers(filtered);
    } else {
      setFilteredMembers(members);
    }
  }, [members, searchTerm]);

  // Fetch member activity data
  useEffect(() => {
    const fetchMemberActivityData = async () => {
      if (!members.length || !group.id) return;

      try {
        setIsLoadingActivity(true);

        // Get all member IDs
        const memberIds = members.map(member => member.id);

        // Fetch activity data for all members in this group
        const activityData = await getBatchGroupUserActivityLast24Hours(memberIds, group.id);

        setMemberActivityData(activityData);
      } catch (err) {
        console.error("Error fetching member activity data:", err);
      } finally {
        setIsLoadingActivity(false);
      }
    };

    fetchMemberActivityData();
  }, [members, group.id]);

  // Search for users to add to the group
  const handleUserSearch = async () => {
    if (!userSearchTerm || userSearchTerm.trim().length < 2) return;

    try {
      setIsSearching(true);
      setSearchResults([]);

      // Import the searchUsers function from database.js
      const { searchUsers } = await import("../firebase/database");

      // Search for users using the searchUsers function
      const users = await searchUsers(userSearchTerm);

      // Filter out users who are already members of the group
      const filteredUsers = users.filter(user =>
        !(group.members && group.members[user.id])
      );

      // Map users to the format expected by the component
      // Only include username (not email) for privacy
      const formattedUsers = filteredUsers.map(user => ({
        id: user.id,
        username: user.username || "Unknown User",
        photoURL: user.photoURL || null
      }));

      setSearchResults(formattedUsers);
    } catch (err) {
      console.error("Error searching users:", err);
      toast({
        title: "Error",
        description: "Failed to search users. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Add a member to the group
  const handleAddMember = async () => {
    if (!selectedUser) return;

    try {
      setIsAddingMember(true);

      // Update the group members
      const groupRef = ref(rtdb, `groups/${group.id}/members/${selectedUser.id}`);
      await set(groupRef, {
        role: "member",
        joinedAt: new Date().toISOString()
      });

      toast({
        title: "Success",
        description: `${selectedUser.username || "User"} has been added to the group.`
      });

      // Reset state
      setSelectedUser(null);
      setUserSearchTerm("");
      setSearchResults([]);
      setIsAddMemberDialogOpen(false);
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error("Error adding member:", err);
      toast({
        title: "Error",
        description: "Failed to add member. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAddingMember(false);
    }
  };

  // Change a member's role
  const handleRoleChange = async (memberId, newRole) => {
    try {
      setIsLoading(true);

      // Update the member's role
      const memberRef = ref(rtdb, `groups/${group.id}/members/${memberId}`);
      await update(memberRef, {
        role: newRole
      });

      toast({
        title: "Success",
        description: `Member role updated to ${newRole}.`
      });

      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error("Error updating member role:", err);
      toast({
        title: "Error",
        description: "Failed to update member role. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Remove a member from the group
  const handleRemoveMember = async (memberId) => {
    try {
      setIsLoading(true);

      // Remove the member
      const memberRef = ref(rtdb, `groups/${group.id}/members/${memberId}`);
      await set(memberRef, null);

      toast({
        title: "Success",
        description: "Member removed from the group."
      });

      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error("Error removing member:", err);
      toast({
        title: "Error",
        description: "Failed to remove member. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Format date for display with relative time and absolute tooltip
  const formatJoinedDate = (dateString) => {
    if (!dateString) return { relative: 'Unknown', absolute: 'Unknown' };
    const relative = formatRelativeTime(dateString);
    const absolute = format(new Date(dateString), 'PPP');
    return { relative, absolute };
  };

  // Get role badge color
  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl font-semibold">Group Members</h2>

        {isOwner && (
          <Button
            variant="outline"
            onClick={() => setIsAddMemberDialogOpen(true)}
            className="gap-1"
          >
            <UserPlus className="h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Members list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="mb-2">{error}</p>
          <Button variant="outline" onClick={() => setRefreshKey(prev => prev + 1)}>
            Try Again
          </Button>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No members found</p>
        </div>
      ) : (
        <div className="border border-theme-medium rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-end gap-1 cursor-help">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                          <span>Activity (24h)</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Group-specific activity in the last 24 hours</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                {isOwner && <TableHead className="w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map(member => (
                <TableRow key={member.id}>
                  <TableCell label="Member">
                    <div>
                      <PillLink href={`/user/${member.id}`}>
                        {member.username || "Unknown User"}
                      </PillLink>
                    </div>
                  </TableCell>
                  <TableCell label="Role">
                    <Badge variant={getRoleBadgeVariant(member.role)}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell label="Joined">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 text-sm cursor-help">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span>{formatJoinedDate(member.joinedAt).relative}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{formatJoinedDate(member.joinedAt).absolute}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell label="Activity (24h)">
                    <div className="w-24 h-8 ml-auto">
                      {isLoadingActivity ? (
                        <div className="flex justify-center items-center h-full">
                          <Loader className="h-3 w-3 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <SimpleSparkline
                          data={memberActivityData[member.id]?.hourly || Array(24).fill(0)}
                          height={32}
                          strokeWidth={1.5}
                          title="Member's edit activity in this group in the last 24 hours"
                        />
                      )}
                    </div>
                  </TableCell>
                  {isOwner && (
                    <TableCell>
                      {member.role !== 'owner' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {member.role !== 'admin' && (
                              <DropdownMenuItem onClick={() => handleRoleChange(member.id, 'admin')}>
                                <Shield className="h-4 w-4 mr-2" />
                                Make Admin
                              </DropdownMenuItem>
                            )}
                            {member.role === 'admin' && (
                              <DropdownMenuItem onClick={() => handleRoleChange(member.id, 'member')}>
                                <User className="h-4 w-4 mr-2" />
                                Remove Admin
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Remove from Group
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Member Dialog */}
      <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member to Group</DialogTitle>
            <DialogDescription>
              Search for users by email or username to add them to this group.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by email or username"
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUserSearch()}
              />
              <Button
                variant="outline"
                onClick={handleUserSearch}
                disabled={isSearching || !userSearchTerm}
              >
                {isSearching ? <Loader className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {searchResults.length > 0 ? (
              <div className="border rounded-md max-h-[200px] overflow-y-auto">
                <Table>
                  <TableBody>
                    {searchResults.map(user => (
                      <TableRow
                        key={user.id}
                        className={`cursor-pointer ${selectedUser?.id === user.id ? 'bg-muted' : ''}`}
                        onClick={() => setSelectedUser(user)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.username || "Unknown User"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="w-[40px]">
                          {selectedUser?.id === user.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : userSearchTerm && !isSearching ? (
              <div className="text-center py-4 text-muted-foreground">
                No users found matching "{userSearchTerm}"
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleAddMember}
              disabled={!selectedUser || isAddingMember}
            >
              {isAddingMember ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
              Add to Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
