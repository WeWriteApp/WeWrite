"use client";
import React, { useContext, useState } from "react";
import { useTheme } from "../providers/ThemeProvider";
import { rtdb } from "../firebase/rtdb";
import { ref, set, onValue, update } from "firebase/database";
import { AuthContext } from "../providers/AuthProvider";
import GroupMembersTable from "./GroupMembersTable";
import PageList from "./PageList";
import AddExistingPageDialog from "./AddExistingPageDialog";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Trash2, Users, FileText, Plus, ChevronLeft, Globe, Lock } from "lucide-react";
import Link from "next/link";
import { Switch } from "./ui/switch";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "./ui/dialog";
import SiteFooter from "./SiteFooter";

export default function GroupDetails({ group }) {
  const { theme } = useTheme();
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isPublic, setIsPublic] = useState(group.isPublic || false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingVisibilityChange, setPendingVisibilityChange] = useState(null);
  
  if (!group) return <div>Loading...</div>;
  
  const isOwner = user?.uid === group.owner;
  const isMember = user?.uid && group.members && group.members[user.uid];

  const handleVisibilityToggle = (newValue) => {
    setPendingVisibilityChange(newValue);
    setShowConfirmDialog(true);
  };

  const confirmVisibilityChange = () => {
    if (pendingVisibilityChange !== null) {
      const groupRef = ref(rtdb, `groups/${group.id}`);
      update(groupRef, { isPublic: pendingVisibilityChange })
        .then(() => {
          setIsPublic(pendingVisibilityChange);
          toast({
            title: "Group visibility updated",
            description: `The group is now ${pendingVisibilityChange ? "public" : "private"}.`,
          });
        })
        .catch((error) => {
          console.error("Error updating group visibility:", error);
          toast({
            title: "Error",
            description: "Failed to update group visibility. Please try again.",
            variant: "destructive",
          });
        });
      setPendingVisibilityChange(null);
      setShowConfirmDialog(false);
    }
  };

  const cancelVisibilityChange = () => {
    setShowConfirmDialog(false);
    setPendingVisibilityChange(null);
  };
  
  // Transform group pages into the format expected by PageList
  const pagesList = group.pages ? Object.entries(group.pages).map(([pageId, page]) => ({
    id: pageId,
    title: page.title,
    isPublic: page.isPublic,
    userId: page.userId,
    lastModified: page.lastModified,
    createdAt: page.createdAt || new Date().toISOString(),
    groupId: group.id
  })) : [];
  
  const handlePagesAdded = () => {
    // Trigger a refresh of the component
    setRefreshKey(prev => prev + 1);
  };
  
  return (
    <div
      className="p-6 bg-background text-foreground min-h-screen space-y-6"
      data-theme={theme}
      key={refreshKey}
    >
      <div className="flex items-center mb-2">
        <Button variant="ghost" size="sm" onClick={() => router.push('/')} className="mr-2">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">{group.name}</h1>
          {group.description && (
            <p className="text-muted-foreground mt-1">{group.description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {isOwner && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-muted p-2 rounded-lg">
                {isPublic ? (
                  <Globe className="h-4 w-4 text-green-500" />
                ) : (
                  <Lock className="h-4 w-4 text-amber-500" />
                )}
                <span className="text-sm font-medium">
                  {isPublic ? "Public" : "Private"}
                </span>
                <Switch
                  checked={isPublic}
                  onCheckedChange={handleVisibilityToggle}
                  aria-label="Toggle group visibility"
                />
              </div>
            </div>
          )}
          
          {isOwner && (
            <DeleteGroupButton group={group} />
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Pages
              </h2>
              <p className="text-sm text-muted-foreground">
                Pages in this group can be edited by all group members
              </p>
            </div>
            {(isOwner || isMember) && (
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link href={`/new?groupId=${group.id}`} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    New Page
                  </Link>
                </Button>
                <AddExistingPageDialog 
                  groupId={group.id}
                  onPagesAdded={handlePagesAdded}
                />
              </div>
            )}
          </div>
          
          <PageList 
            pages={pagesList}
            mode="grid"
            emptyState={
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No pages in this group yet</p>
                {(isOwner || isMember) && (
                  <div className="flex gap-2 justify-center mt-4">
                    <Button variant="outline" asChild>
                      <Link href={`/new?groupId=${group.id}`}>Create your first page</Link>
                    </Button>
                    <AddExistingPageDialog 
                      groupId={group.id}
                      onPagesAdded={handlePagesAdded}
                    />
                  </div>
                )}
              </div>
            }
          />
        </div>
        
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Members
            </h2>
            <p className="text-sm text-muted-foreground">
              {Object.keys(group.members || {}).length} {Object.keys(group.members || {}).length === 1 ? 'member' : 'members'} in this group
            </p>
          </div>
          
          {group.members && (
            <GroupMembersTable 
              members={group.members} 
              groupId={group.id} 
              isOwner={isOwner} 
            />
          )}
        </div>
      </div>
      
      <SiteFooter />

      <Dialog open={showConfirmDialog} onOpenChange={(open) => {
        setShowConfirmDialog(open);
        if (!open) {
          setPendingVisibilityChange(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Group Visibility</DialogTitle>
            <DialogDescription>
              {pendingVisibilityChange
                ? "Making this group public will allow anyone to see it and its pages. Continue?"
                : "Making this group private will hide it and its pages from non-members. Continue?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="outline" onClick={cancelVisibilityChange}>
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={confirmVisibilityChange}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const DeleteGroupButton = ({ group }) => {
  const router = useRouter();
  
  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this group? All pages will remain but will no longer be associated with this group.")) {
      const groupRef = ref(rtdb, `groups/${group.id}`);
      set(groupRef, null);
      router.push("/");
    } 
  };
  
  return (
    <Button
      variant="destructive"
      onClick={handleDelete}
      className="flex items-center gap-2"
    >
      <Trash2 className="h-4 w-4" />
      Delete Group
    </Button>
  );
};
