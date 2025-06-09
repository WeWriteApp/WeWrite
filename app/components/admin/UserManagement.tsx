"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Search, Mail, MailCheck, Clock, RefreshCw } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getQueueCount } from '../../utils/syncQueue';

interface UserData {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
  emailVerified?: boolean;
  createdAt?: string;
  lastLogin?: string;
  queueCount?: number;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);

  // Load users from Firestore
  const loadUsers = async () => {
    setLoading(true);
    try {
      const usersQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      
      const snapshot = await getDocs(usersQuery);
      const userData: UserData[] = [];
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const user: UserData = {
          uid: doc.id,
          email: data.email || 'No email',
          username: data.username,
          displayName: data.displayName,
          emailVerified: data.emailVerified || false,
          createdAt: data.createdAt,
          lastLogin: data.lastLogin
        };
        
        // Get queue count for this user (this would need to be implemented)
        // For now, we'll simulate it
        user.queueCount = Math.floor(Math.random() * 10);
        
        userData.push(user);
      }
      
      setUsers(userData);
      setFilteredUsers(userData);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter users based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, []);

  const getVerificationBadge = (emailVerified: boolean) => {
    if (emailVerified) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <MailCheck className="h-3 w-3 mr-1" />
          Verified
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
        <Mail className="h-3 w-3 mr-1" />
        Unverified
      </Badge>
    );
  };

  const getQueueBadge = (queueCount: number) => {
    if (queueCount === 0) {
      return null;
    }
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
        <Clock className="h-3 w-3 mr-1" />
        {queueCount} queued
      </Badge>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>User Management</span>
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsers}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>
          Manage users, view email verification status, and monitor sync queues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by email, username, or display name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* User Statistics */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <p className="text-2xl font-bold">{users.length}</p>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {users.filter(u => u.emailVerified).length}
            </p>
            <p className="text-sm text-muted-foreground">Verified</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">
              {users.filter(u => !u.emailVerified).length}
            </p>
            <p className="text-sm text-muted-foreground">Unverified</p>
          </div>
        </div>

        {/* Users List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Loading users...</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredUsers.map((user) => (
              <div
                key={user.uid}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <p className="font-medium truncate">{user.email}</p>
                    {getVerificationBadge(user.emailVerified || false)}
                    {user.queueCount !== undefined && getQueueBadge(user.queueCount)}
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    {user.username && (
                      <span>@{user.username}</span>
                    )}
                    <span>Joined: {formatDate(user.createdAt)}</span>
                    {user.lastLogin && (
                      <span>Last login: {formatDate(user.lastLogin)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {filteredUsers.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'No users found matching your search.' : 'No users found.'}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
