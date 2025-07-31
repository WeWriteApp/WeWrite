'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { doc, getDoc } from "firebase/firestore";
import { addUsername, updateEmail as updateFirebaseEmail, updatePassword, checkUsernameAvailability } from "../../firebase/auth";
import { db } from "../../firebase/database";
import { validateUsernameFormat } from '../../utils/usernameValidation';
import { useRouter } from 'next/navigation';

import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { EmailVerificationStatus } from '../../components/utils/EmailVerificationStatus';
import { useAlert } from '../../hooks/useAlert';
import { useConfirmation } from '../../hooks/useConfirmation';
import AlertModal from '../../components/utils/AlertModal';
import ConfirmationModal from '../../components/utils/ConfirmationModal';
import { ChevronLeft, Edit3, Save, X, AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';
import NavHeader from '../../components/layout/NavHeader';

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Custom modal hooks
  const { alertState, showError, showSuccess, closeAlert } = useAlert();
  const { confirmationState, confirm, closeConfirmation } = useConfirmation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

  // Edit state management
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [tempEmail, setTempEmail] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    loadUserData();
  }, [isAuthenticated, user, router]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      // Load user profile data
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentUsername = userData.username || '';
        const currentEmail = user.email || '';
        setUsername(currentUsername);
        setEmail(currentEmail);
        setTempUsername(currentUsername);
        setTempEmail(currentEmail);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
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
    } catch (error) {
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
        await showSuccess('Success', 'Password updated successfully!');
      } else {
        setPasswordError(result.error?.message || 'Failed to update password');
      }
    } catch (error) {
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

    // Validate username format first
    const formatValidation = validateUsernameFormat(newUsername);
    if (!formatValidation.isValid) {
      await showError('Invalid Username', formatValidation.message);
      return;
    }

    try {
      setLoading(true);

      // Check username availability
      const availabilityResult = await checkUsernameAvailability(newUsername);

      if (typeof availabilityResult === 'object' && !availabilityResult.isAvailable) {
        await showError('Username Not Available', availabilityResult.message);
        return;
      } else if (typeof availabilityResult === 'boolean' && !availabilityResult) {
        await showError('Username Taken', 'Username is already taken. Please choose a different username.');
        return;
      }

      // Add username to user profile
      await addUsername(user.uid, newUsername);

      // Update local state
      setUsername(newUsername);

      // Show success message
      await showSuccess('Success', 'Username updated successfully!');
    } catch (error) {
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

      // Update email in Firebase Auth
      await updateFirebaseEmail(newEmail);

      // Update local state
      setEmail(newEmail);

      // Show success message
      await showSuccess('Success', 'Email updated successfully!');
    } catch (error) {
      console.error('Error updating email:', error);
      setEmailError(error.message || 'Failed to update email');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div>
      <div className="lg:hidden">
        <NavHeader backUrl="/settings" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 md:pb-8">

        {/* Profile Section */}
        <Card className="wewrite-card">
          <CardHeader className="pb-6">
            <CardTitle className="text-xl font-semibold">Profile Information</CardTitle>
            <CardDescription className="text-muted-foreground">
              Update your username, email, and password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Username Field */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-foreground">
                Username
              </Label>
              <div className="flex gap-3 items-center">
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
                        : 'border-border/50 bg-muted/30 text-muted-foreground'
                    }`}
                  />
                </div>
                <div className="flex gap-2">
                  {isEditingUsername ? (
                    <>
                      <Button
                        size="sm"
                        onClick={handleSaveUsername}
                        disabled={loading || !tempUsername.trim()}
                        className="h-9 px-3"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelUsername}
                        disabled={loading}
                        className="h-9 px-3"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleEditUsername}
                      className="h-9 px-3"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
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
              <div className="flex gap-3 items-center">
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
                        : 'border-border/50 bg-muted/30 text-muted-foreground'
                    }`}
                  />
                </div>
                <div className="flex gap-2">
                  {isEditingEmail ? (
                    <>
                      <Button
                        size="sm"
                        onClick={handleSaveEmail}
                        disabled={loading || !tempEmail.trim()}
                        className="h-9 px-3"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEmail}
                        disabled={loading}
                        className="h-9 px-3"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleEditEmail}
                      className="h-9 px-3"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>

              {/* Email Verification Status */}
              <div className="mt-3">
                <EmailVerificationStatus />
              </div>

              {/* Email Error */}
              {emailError && (
                <div className="flex items-center gap-2 mt-2 p-3 bg-destructive/10 border-theme-medium rounded-md">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
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
                <div className="flex gap-3 items-center">
                  <div className="flex-1">
                    <Input
                      id="password"
                      type="password"
                      value="••••••••"
                      disabled={true}
                      className="border-border/50 bg-muted/30 text-muted-foreground"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleEditPassword}
                      className="h-9 px-3"
                    >
                      <Lock className="h-4 w-4 mr-1" />
                      Change
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Current Password */}
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
                        className="pr-10 border-primary ring-1 ring-primary/20 bg-background"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* New Password */}
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
                        className="pr-10 border-primary ring-1 ring-primary/20 bg-background"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
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
                        className="pr-10 border-primary ring-1 ring-primary/20 bg-background"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Password Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSavePassword}
                      disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                      className="h-9 px-3"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Update Password
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelPassword}
                      disabled={loading}
                      className="h-9 px-3"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>

                  {/* Password Error */}
                  {passwordError && (
                    <div className="flex items-center gap-2 mt-2 p-3 bg-destructive/10 border-theme-medium rounded-md">
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <p className="text-sm text-red-700 dark:text-red-300">{passwordError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="pt-6 border-t-only">
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                // Check if there are multiple accounts to determine logout behavior
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
                  // Import and call the logout function with appropriate parameters
                  import('../../firebase/auth').then(({ logoutUser }) => {
                    // If multiple accounts, try to return to previous account
                    // Otherwise, do a normal logout
                    logoutUser(false, hasMultipleAccounts).then((result) => {
                      if (!result.returnedToPrevious) {
                        // If we didn't return to a previous account, redirect to home
                        router.push('/');
                      }
                      // If we returned to previous account, the redirect is handled by logoutUser
                    });
                  });
                }
              }}
              className="ml-auto"
            >
              Logout
            </Button>
          </CardFooter>
        </Card>

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
    </div>
  );
}