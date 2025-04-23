"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Loader } from 'lucide-react';
import { checkUsernameAvailability, addUsername } from '../firebase/auth';
import { useAuth } from '../providers/AuthProvider';

export default function UsernameEnforcementModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if the user has a username
  useEffect(() => {
    if (user && (!user.username || user.username === '')) {
      setOpen(true);
    }
  }, [user]);

  // Check username availability with debounce
  useEffect(() => {
    if (!username || username.length < 3) {
      setIsAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      try {
        const available = await checkUsernameAvailability(username);
        setIsAvailable(available);
      } catch (error) {
        console.error('Error checking username availability:', error);
        setIsAvailable(false);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSave = async () => {
    if (!user || !username || !isAvailable) return;

    setIsSaving(true);
    setError(null);

    try {
      await addUsername(user.uid, username);
      // Success - close modal
      setOpen(false);
    } catch (error) {
      console.error('Error saving username:', error);
      setError('Failed to save username. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Validate username format
  const isValidFormat = username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto rounded-lg animate-in fade-in-0 zoom-in-95 duration-300">
        <DialogHeader>
          <DialogTitle>Set Your Username</DialogTitle>
          <DialogDescription>
            You must set a username to continue using WeWrite.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`${!isValidFormat && username.length > 0 ? 'border-red-500' : ''} 
                           ${isAvailable === true ? 'border-green-500' : ''} 
                           ${isAvailable === false ? 'border-red-500' : ''}`}
              />
              
              {/* Validation messages */}
              {!isValidFormat && username.length > 0 && (
                <p className="text-sm text-red-500">
                  Username must be at least 3 characters and contain only letters, numbers, and underscores.
                </p>
              )}
              
              {isChecking && (
                <p className="text-sm text-muted-foreground flex items-center">
                  <Loader className="h-3 w-3 animate-spin mr-1" />
                  Checking availability...
                </p>
              )}
              
              {isAvailable === true && !isChecking && (
                <p className="text-sm text-green-500">Username is available!</p>
              )}
              
              {isAvailable === false && !isChecking && (
                <p className="text-sm text-red-500">Username is already taken.</p>
              )}
              
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
            </div>
            
            <Button 
              onClick={handleSave} 
              disabled={!isAvailable || isSaving || !isValidFormat}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Username'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
