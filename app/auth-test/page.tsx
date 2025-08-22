"use client";

import React, { useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Loader2, User, Mail, Shield, Clock } from 'lucide-react';

/**
 * Auth Test Page
 *
 * This page demonstrates the authentication system
 * and allows testing of all auth functions.
 */
export default function AuthTestPage() {
  const {
    user,
    isLoading,
    isAuthenticated,
    error,
    signIn,
    signOut,
    refreshUser,
    clearError
  } = useAuth();

  const [email, setEmail] = useState('test1@wewrite.dev');
  const [password, setPassword] = useState('testpass123');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      clearError();
      await signIn(email, password);
    } catch (error) {
      console.error('Sign in failed:', error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshUser();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading authentication...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Simple Auth Test</h1>
          <p className="text-muted-foreground mt-2">
            Testing the new authentication system
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="ml-2"
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Authentication Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Authentication Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="font-medium">Status:</span>
                <span className={`px-2 py-1 rounded text-sm ${
                  isAuthenticated 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-medium">Loading:</span>
                <span>{isLoading ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Information */}
        {isAuthenticated && user && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>User Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Email:</span>
                  <span>[REDACTED FOR SECURITY]</span>
                  {user.emailVerified && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                      Verified
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Username:</span>
                  <span>{user.username}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Display Name:</span>
                  <span>{user.displayName}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">UID:</span>
                  <span className="font-mono text-sm">{user.uid}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Last Login:</span>
                  <span className="text-sm">{new Date(user.lastLoginAt).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sign In Form */}
        {!isAuthenticated && (
          <Card>
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>
                Use test credentials: test1@wewrite.dev / testpass123
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Email or Username
                  </label>
                  <Input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email or username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Password
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                  />
                </div>
                <Button
                  onClick={handleSignIn}
                  disabled={isSigningIn || !email || !password}
                  className="w-full"
                >
                  {isSigningIn ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Signing In...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {isAuthenticated && (
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  className="w-full"
                >
                  Refresh User Data
                </Button>
                <Button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  variant="destructive"
                  className="w-full"
                >
                  {isSigningOut ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Signing Out...
                    </>
                  ) : (
                    'Sign Out'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Users */}
        <Card>
          <CardHeader>
            <CardTitle>Available Test Users</CardTitle>
            <CardDescription>
              Click to quickly fill in credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { email: 'test1@wewrite.dev', username: 'testuser1', role: 'Regular User' },
                { email: 'test2@wewrite.dev', username: 'testuser2', role: 'Regular User' },
                { email: 'admin@wewrite.dev', username: 'testadmin', role: 'Admin' },
                { email: 'writer@wewrite.dev', username: 'testwriter', role: 'Writer' }
              ].map((testUser) => (
                <Button
                  key={testUser.email}
                  variant="outline"
                  size="sm"
                  onClick={() => setEmail(testUser.email)}
                  className="text-left justify-start"
                >
                  <div>
                    <div className="font-medium">{testUser.username}</div>
                    <div className="text-xs text-muted-foreground">{testUser.role}</div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
