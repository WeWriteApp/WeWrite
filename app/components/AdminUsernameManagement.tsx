"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Users, Search, Check, X, Loader } from 'lucide-react';
import { db } from '../firebase/database';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { addUsername } from '../firebase/auth';

interface AdminUsernameManagementProps {
  userEmail: string;
}

export default function AdminUsernameManagement({ userEmail }: AdminUsernameManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSearch = async () => {
    if (!searchTerm) return;

    try {
      setIsSearching(true);
      setError('');
      setSearchResults([]);
      setSelectedUser(null);

      // Search by email
      const emailQuery = query(collection(db, 'users'), where('email', '==', searchTerm));
      const emailSnapshot = await getDocs(emailQuery);

      // Search by username
      const usernameQuery = query(collection(db, 'users'), where('username', '==', searchTerm));
      const usernameSnapshot = await getDocs(usernameQuery);

      // Combine results
      const results: any[] = [];
      
      emailSnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
      
      usernameSnapshot.forEach((doc) => {
        // Avoid duplicates
        if (!results.some(user => user.id === doc.id)) {
          results.push({ id: doc.id, ...doc.data() });
        }
      });

      setSearchResults(results);
      
      if (results.length === 0) {
        setError('No users found');
      }
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = (user: any) => {
    setSelectedUser(user);
    setNewUsername(user.username || '');
  };

  const handleUpdateUsername = async () => {
    if (!selectedUser || !newUsername) return;

    try {
      setIsLoading(true);
      setError('');
      setSuccess('');

      // Check if username is already taken
      const usernameQuery = query(collection(db, 'users'), where('username', '==', newUsername));
      const usernameSnapshot = await getDocs(usernameQuery);
      
      if (!usernameSnapshot.empty && usernameSnapshot.docs[0].id !== selectedUser.id) {
        setError('Username is already taken');
        setIsLoading(false);
        return;
      }

      // Update username
      await addUsername(selectedUser.id, newUsername);

      // Update local state
      setSelectedUser({
        ...selectedUser,
        username: newUsername
      });

      setSuccess('Username updated successfully');
    } catch (err) {
      console.error('Error updating username:', err);
      setError('Failed to update username');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Username Management
        </CardTitle>
        <CardDescription>
          Admin tool to manage user usernames
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Search by email or username"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button 
            variant="outline" 
            onClick={handleSearch}
            disabled={isSearching || !searchTerm}
          >
            {isSearching ? <Loader className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-2 text-sm text-destructive bg-destructive/10 rounded">
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="p-2 text-sm text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20 rounded">
            {success}
          </div>
        )}

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="border rounded-md overflow-hidden">
            <div className="text-sm font-medium p-2 bg-muted">
              Search Results
            </div>
            <div className="divide-y">
              {searchResults.map((user) => (
                <div 
                  key={user.id} 
                  className={`p-2 flex justify-between items-center cursor-pointer hover:bg-muted/50 ${selectedUser?.id === user.id ? 'bg-muted/50' : ''}`}
                  onClick={() => handleSelectUser(user)}
                >
                  <div>
                    <div className="font-medium">{user.username || 'No username'}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                  <Button variant="ghost" size="sm">
                    Select
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected user */}
        {selectedUser && (
          <div className="border rounded-md p-3 space-y-3">
            <div className="font-medium">Update Username</div>
            <div className="text-sm">
              <span className="text-muted-foreground">User: </span>
              <span>{selectedUser.email}</span>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="New username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
              <Button 
                onClick={handleUpdateUsername}
                disabled={isLoading || !newUsername || newUsername === selectedUser.username}
              >
                {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : 'Update'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
