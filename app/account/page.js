"use client";

import React, { useContext, useState } from 'react';
import { AuthContext } from '@/app/providers/AuthProvider';
import { updateDoc } from '@/app/firebase/database';

export default function ProfilePage() {
  const { user } = useContext(AuthContext);
  const [username, setUsername] = useState(user?.username || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const handleSave = async () => {
    if (!user || !username.trim()) return;
    
    try {
      setIsSaving(true);
      
      // Update username in database
      await updateDoc('users', user.uid, { username });
      
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="bg-background/40 border-[1.5px] border-[rgba(255,255,255,0.1)] p-6 rounded-lg">
      <h2 className="text-xl font-semibold mb-6">Profile Information</h2>
      
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-400 mb-1">Email</p>
          <p>{user?.email}</p>
        </div>
        
        <div>
          <p className="text-sm text-gray-400 mb-1">Username</p>
          {isEditing ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-background border border-[rgba(255,255,255,0.2)] rounded px-3 py-1 flex-1"
              />
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-1 bg-[#0057FF] hover:bg-[#0046CC] text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setUsername(user?.username || '');
                }}
                className="px-4 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <p>{user?.username || 'Not set'}</p>
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-[#0057FF] hover:text-[#0046CC]"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 