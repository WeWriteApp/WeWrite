"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDatabase, ref, push, set } from "firebase/database";
import { app } from "../../firebase/config";
import { useAuth } from "../../providers/AuthProvider";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewGroupPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("You must be logged in to create a group");
      return;
    }
    
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const db = getDatabase(app);
      const groupsRef = ref(db, "groups");
      const newGroupRef = push(groupsRef);
      
      // Create the group
      await set(newGroupRef, {
        name,
        description,
        isPrivate,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        members: {
          [user.uid]: {
            role: "admin",
            joinedAt: new Date().toISOString()
          }
        }
      });
      
      // Add the group to the user's groups
      const userGroupsRef = ref(db, `users/${user.uid}/groups/${newGroupRef.key}`);
      await set(userGroupsRef, {
        role: "admin",
        joinedAt: new Date().toISOString()
      });
      
      toast.success("Group created successfully!");
      router.push(`/group/${newGroupRef.key}`);
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Failed to create group. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
      
      <h1 className="text-3xl font-bold mb-6">Create a New Group</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Group Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter group name"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this group is about"
            rows={4}
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isPrivate"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <Label htmlFor="isPrivate" className="text-sm font-medium">
            Make this group private (only visible to members)
          </Label>
        </div>
        
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? "Creating..." : "Create Group"}
          </Button>
        </div>
      </form>
    </div>
  );
}
