"use client";

import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../providers/AuthProvider";
import { rtdb } from '../firebase/rtdb';
import { onValue, ref, get } from "firebase/database";
import Link from "next/link";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { ChevronRight, Users, FileText, Plus } from "lucide-react";
import { useMediaQuery } from "../hooks/use-media-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface Group {
  id: string;
  name: string;
  description?: string;
  members?: Record<string, { role: string; joinedAt: string }>;
  pages?: Record<string, boolean>;
  owner?: string;
  ownerUsername?: string;
}

export default function MyGroups() {
  const { user } = useContext(AuthContext);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  useEffect(() => {
    if (!user?.uid) return;
    
    // Function to fetch groups where user is a member or owner
    const fetchGroups = () => {
      const groupsRef = ref(rtdb, 'groups');
      
      return onValue(groupsRef, async (snapshot) => {
        if (!snapshot.exists()) {
          setGroups([]);
          setLoading(false);
          return;
        }
        
        const allGroups = snapshot.val();
        const userGroups: Group[] = [];
        
        // Get all users to find owner usernames
        const usersRef = ref(rtdb, 'users');
        const usersSnapshot = await get(usersRef);
        const usersData = usersSnapshot.exists() ? usersSnapshot.val() : {};
        
        Object.keys(allGroups).forEach(groupId => {
          const group = allGroups[groupId];
          
          // Check if user is a member or owner
          const isMember = group.members && Object.keys(group.members).some(
            memberId => memberId === user.uid && group.members[memberId].role === 'member'
          );
          const isOwner = group.owner === user.uid;
          
          if (isMember || isOwner) {
            // Get owner username
            const ownerUsername = group.owner && usersData[group.owner] 
              ? usersData[group.owner].username 
              : 'Unknown';
              
            userGroups.push({
              id: groupId,
              name: group.name,
              description: group.description,
              members: group.members,
              pages: group.pages,
              owner: group.owner,
              ownerUsername
            });
          }
        });
        
        setGroups(userGroups);
        setLoading(false);
      });
    };
    
    const unsubscribe = fetchGroups();
    return () => unsubscribe();
  }, [user?.uid]);
  
  // Function to get member count
  const getMemberCount = (members?: Record<string, { role: string; joinedAt: string }>) => {
    return members ? Object.keys(members).length : 0;
  };
  
  // Function to get page count
  const getPageCount = (pages?: Record<string, boolean>) => {
    return pages ? Object.keys(pages).length : 0;
  };
  
  if (loading) {
    return (
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold flex items-center">
            <Users className="h-5 w-5 mr-2" />
            My Groups
          </h2>
        </div>
        <div className={isMobile ? "flex overflow-x-auto space-x-4 pb-4" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"}>
          {[1, 2, 3, 4].map((_, index) => (
            <Card key={index} className="min-w-[250px] md:min-w-0 animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-6 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="h-4 bg-muted rounded w-full mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardContent>
              <CardFooter>
                <div className="h-4 bg-muted rounded w-full"></div>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  
  if (groups.length === 0) {
    return (
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold flex items-center">
            <Users className="h-5 w-5 mr-2" />
            My Groups
          </h2>
          <Button variant="outline" asChild>
            <Link href="/groups/new" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Group
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">You haven't joined any groups yet.</p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/groups/new">Create a Group</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Only show first 4 groups
  const displayGroups = groups.slice(0, 4);
  
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold flex items-center">
          <Users className="h-5 w-5 mr-2" />
          My Groups
        </h2>
        <Button variant="outline" asChild>
          <Link href="/groups/new" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Group
          </Link>
        </Button>
      </div>
      
      {isMobile ? (
        <div className="flex overflow-x-auto space-x-4 pb-4 scrollbar-hide">
          {displayGroups.map((group) => (
            <Link key={group.id} href={`/groups/${group.id}`} className="block min-w-[250px]">
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{group.name}</CardTitle>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="flex items-center text-sm text-muted-foreground mb-2">
                    <span>by {group.ownerUsername}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="ml-1 text-sm">{getMemberCount(group.members)}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{getMemberCount(group.members)} members</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="ml-1 text-sm">{getPageCount(group.pages)}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{getPageCount(group.pages)} pages</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          
          {groups.length > 4 && (
            <div className="flex items-center justify-center min-w-[100px]">
              <Button variant="ghost" asChild>
                <Link href="/groups" className="flex items-center">
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {displayGroups.map((group) => (
            <Link key={group.id} href={`/groups/${group.id}`} className="block">
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{group.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground mb-2">
                    <span>by {group.ownerUsername}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="ml-1 text-sm">{getMemberCount(group.members)}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{getMemberCount(group.members)} members</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="ml-1 text-sm">{getPageCount(group.pages)}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{getPageCount(group.pages)} pages</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      
      {groups.length > 4 && !isMobile && (
        <div className="flex justify-center mt-4">
          <Button variant="outline" asChild>
            <Link href="/groups" className="flex items-center gap-2">
              View All Groups
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
