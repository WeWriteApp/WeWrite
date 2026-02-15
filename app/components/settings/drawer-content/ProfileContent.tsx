'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '../../../providers/AuthProvider';
import { doc, getDoc } from "firebase/firestore";
import { updateEmail as updateFirebaseEmail, updatePassword, checkUsernameAvailability } from "../../../firebase/auth";
import { usernameApi } from "../../../utils/apiClient";
import { db } from "../../../firebase/database";
import { validateUsernameFormat } from '../../../utils/usernameValidation';
import { getCollectionName } from '../../../utils/environmentConfig';

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { EmailVerificationStatus } from '../../utils/EmailVerificationStatus';
import { useAlert } from '../../../hooks/useAlert';
import { useConfirmation } from '../../../hooks/useConfirmation';
import { AlertModal, ConfirmationModal } from '../../utils/UnifiedModal';

interface ProfileContentProps {
  onClose: () => void;
}

export default function ProfileContent({ onClose }: ProfileContentProps) {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();

  const { alertState, showError, showSuccess, closeAlert } = useAlert();
  const { confirmationState, confirm, closeConfirmation } = useConfirmation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [tempEmail, setTempEmail] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Cooldown state
  const [cooldownBlocked, setCooldownBlocked] = useState(false);
  const [cooldownMessage, setCooldownMessage] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) return;
    loadUserData();
  }, [isAuthenticated, isLoading, user]);

  const loadUserData = async () => {
    if (!user) return;

    const authUsername = user.username || '';
    const authEmail = user.email || '';
    setUsername(authUsername);
    setTempUsername(authUsername);
    setEmail(authEmail);
    setTempEmail(authEmail);

    try {
      const userDocRef = doc(db, getCollectionName('users'), user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentUsername = userData.username || authUsername;
        const currentEmail = userData.email || authEmail;
        setUsername(currentUsername);
        setEmail(currentEmail);
        setTempUsername(currentUsername);
        setTempEmail(currentEmail);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }

    // Fetch cooldown status
    try {
      const cooldownResult = await usernameApi.getCooldownStatus();
      if (cooldownResult.success && cooldownResult.data?.blocked) {
        setCooldownBlocked(true);
        setCooldownMessage(cooldownResult.data.message || 'Username change is on cooldown.');
      } else {
        setCooldownBlocked(false);
        setCooldownMessage('');
      }
    } catch (error) {
      console.error('Error fetching cooldown status:', error);
    }
  };

  const handleEditUsername = () => {
    setTempUsername(username);
    setIsEditingUsername(true);
  };

  const handleSaveUsername = async () => {
    if (!tempUsername.trim()) return;

    setLoading(true);
    try {
      await handleUsernameChange(tempUsername);
      setIsEditingUsername(false);
    } catch (error) {
      console.error('Error updating username:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelUsername = () => {
    setTempUsername(username);
    setIsEditingUsername(false);
  };

  const handleEditEmail = () => {
    setTempEmail(email);
    setIsEditingEmail(true);
  };

  const handleSaveEmail = async () => {
    if (!tempEmail.trim()) return;

    setLoading(true);
    setEmailError('');
    try {
      await handleEmailChange(tempEmail);
      setIsEditingEmail(false);
    } catch (error: any) {
      console.error('Error updating email:', error);
      setEmailError(error.message || 'Failed to update email');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEmail = () => {
    setTempEmail(email);
    setIsEditingEmail(false);
    setEmailError('');
  };

  const handleEditPassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setIsEditingPassword(true);
  };

  const handleSavePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    setLoading(true);
    setPasswordError('');
    try {
      const result = await updatePassword(currentPassword, newPassword);
      if (result.success) {
        setIsEditingPassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        await showSuccess('Success', 'Password updated successfully! Save this password in your password manager.');
      } else {
        setPasswordError(result.error?.message || 'Failed to update password');
      }
    } catch (error: any) {
      console.error('Error updating password:', error);
      setPasswordError(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setIsEditingPassword(false);
  };

  const handleUsernameChange = async (newUsername: string) => {
    if (!user) return;
    if (!newUsername || newUsername === username) return;

    const formatValidation = validateUsernameFormat(newUsername);
    if (!formatValidation.isValid) {
      await showError('Invalid Username', formatValidation.message);
      return;
    }

    try {
      setLoading(true);

      const availabilityResult = await checkUsernameAvailability(newUsername);

      if (typeof availabilityResult === 'object' && !availabilityResult.isAvailable) {
        await showError('Username Not Available', availabilityResult.message);
        return;
      } else if (typeof availabilityResult === 'boolean' && !availabilityResult) {
        await showError('Username Taken', 'Username is already taken. Please choose a different username.');
        return;
      }

      const result = await usernameApi.setUsername(newUsername);

      if (!result.success) {
        throw new Error(result.error || 'Failed to update username');
      }

      setUsername(newUsername);
      await showSuccess('Success', 'Username updated successfully!');
    } catch (error: any) {
      console.error('Error updating username:', error);
      await showError('Update Failed', `Failed to update username: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = async (newEmail: string) => {
    if (!user) return;
    if (!newEmail || newEmail === email) return;

    try {
      setLoading(true);
      setEmailError('');

      await updateFirebaseEmail(newEmail);
      setEmail(newEmail);
      await showSuccess('Success', 'Email updated successfully!');
    } catch (error: any) {
      console.error('Error updating email:', error);
      setEmailError(error.message || 'Failed to update email');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icon name="Loader" size={24} className="text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="px-4 pb-6 space-y-6">
      {/* Username Field */}
      <div className="space-y-2">
        <Label htmlFor="username" className="text-sm font-medium text-foreground">
          Username
        </Label>
        {cooldownBlocked && !isEditingUsername && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
            <Icon name="Clock" size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">{cooldownMessage}</p>
          </div>
        )}
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <Input
              id="username"
              type="text"
              value={isEditingUsername ? tempUsername : username}
              onChange={(e) => setTempUsername(e.target.value)}
              disabled={!isEditingUsername}
              placeholder={username || "No username set"}
              className={`transition-all duration-200 ${
                isEditingUsername
                  ? 'border-primary ring-1 ring-primary/20 bg-background'
                  : 'border-theme-light bg-muted/30 text-muted-foreground'
              }`}
            />
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {isEditingUsername ? (
              <>
                <Button
                  size="icon-sm"
                  variant="success"
                  onClick={handleSaveUsername}
                  disabled={loading || !tempUsername.trim() || tempUsername === username}
                  className={tempUsername !== username ? 'shadow-styled-success' : ''}
                >
                  <Icon name="Check" size={16} />
                </Button>
                <Button
                  size="icon-sm"
                  variant="secondary"
                  onClick={handleCancelUsername}
                  disabled={loading}
                >
                  <Icon name={tempUsername !== username ? "RotateCcw" : "X"} size={16} />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleEditUsername}
                disabled={cooldownBlocked}
                className="h-9 px-3"
              >
                <Icon name="Edit3" size={16} className="mr-1" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium text-foreground">
          Email Address
        </Label>
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <Input
              id="email"
              type="email"
              value={isEditingEmail ? tempEmail : email}
              onChange={(e) => setTempEmail(e.target.value)}
              disabled={!isEditingEmail}
              placeholder="Enter your email address"
              className={`transition-all duration-200 ${
                isEditingEmail
                  ? 'border-primary ring-1 ring-primary/20 bg-background'
                  : 'border-theme-light bg-muted/30 text-muted-foreground'
              }`}
            />
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {isEditingEmail ? (
              <>
                <Button
                  size="sm"
                  onClick={handleSaveEmail}
                  disabled={loading || !tempEmail.trim()}
                  className="h-9 px-3"
                >
                  <Icon name="Save" size={16} className="mr-1" />
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCancelEmail}
                  disabled={loading}
                  className="h-9 px-3"
                >
                  <Icon name="X" size={16} />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleEditEmail}
                className="h-9 px-3"
              >
                <Icon name="Edit3" size={16} className="mr-1" />
                Edit
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3">
          <EmailVerificationStatus />
        </div>

        {emailError && (
          <div className="flex items-center gap-2 mt-2 p-3 bg-destructive/10 border-theme-medium rounded-md">
            <Icon name="AlertCircle" size={16} className="text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-300">{emailError}</p>
          </div>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium text-foreground">
          Password
        </Label>
        {!isEditingPassword ? (
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <Input
                id="password"
                type="password"
                value="••••••••"
                disabled={true}
                className="border-theme-light bg-muted/30 text-muted-foreground"
              />
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleEditPassword}
                className="h-9 px-3"
              >
                <Icon name="Lock" size={16} className="mr-1" />
                Change
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-sm font-medium text-foreground">
                Current Password
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  className="pr-10 border-primary ring-1 ring-primary/20 bg-background"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  <Icon name={showCurrentPassword ? "EyeOff" : "Eye"} size={16} />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-medium text-foreground">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  className="pr-10 border-primary ring-1 ring-primary/20 bg-background"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  <Icon name={showNewPassword ? "EyeOff" : "Eye"} size={16} />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className="pr-10 border-primary ring-1 ring-primary/20 bg-background"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Icon name={showConfirmPassword ? "EyeOff" : "Eye"} size={16} />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSavePassword}
                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                className="h-9 px-3"
              >
                <Icon name="Save" size={16} className="mr-1" />
                Update
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleCancelPassword}
                disabled={loading}
                className="h-9 px-3"
              >
                <Icon name="X" size={16} className="mr-1" />
                Cancel
              </Button>
            </div>

            {passwordError && (
              <div className="flex items-center gap-2 mt-2 p-3 bg-destructive/10 border-theme-medium rounded-md">
                <Icon name="AlertCircle" size={16} className="text-red-600 dark:text-red-400" />
                <p className="text-sm text-red-700 dark:text-red-300">{passwordError}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Logout Button */}
      <div className="pt-4 border-t border-border">
        <Button
          variant="destructive"
          size="sm"
          onClick={async () => {
            const savedAccountsJson = localStorage.getItem('savedAccounts');
            let hasMultipleAccounts = false;

            if (savedAccountsJson) {
              try {
                const savedAccounts = JSON.parse(savedAccountsJson);
                hasMultipleAccounts = savedAccounts.length > 1;
              } catch (e) {
                console.error('Error parsing saved accounts:', e);
              }
            }

            const confirmMessage = hasMultipleAccounts
              ? "Are you sure you want to log out? You will be switched back to your previous account."
              : "Are you sure you want to log out?";

            const confirmed = await confirm({
              title: 'Log Out',
              message: confirmMessage,
              confirmText: 'Log Out',
              cancelText: 'Cancel',
              variant: 'default',
              icon: 'logout'
            });

            if (confirmed) {
              onClose();
              signOut();
            }
          }}
          className="w-full"
        >
          <Icon name="LogOut" size={16} className="mr-2" />
          Log Out
        </Button>
      </div>

      {/* Modals */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
      />

      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        onClose={closeConfirmation}
        onConfirm={confirmationState.onConfirm}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmText={confirmationState.confirmText}
        cancelText={confirmationState.cancelText}
        variant={confirmationState.variant}
        icon={confirmationState.icon}
      />
    </div>
  );
}
