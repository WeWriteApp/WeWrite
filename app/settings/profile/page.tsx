'use client';

import React, { useState, useEffect } from 'react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { doc, getDoc } from "firebase/firestore";
import { addUsername, updateEmail as updateFirebaseEmail, checkUsernameAvailability } from "../../firebase/auth";
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
import { ChevronLeft, Edit3, Save, X, AlertCircle } from 'lucide-react';

export default function ProfilePage() {
  const { currentAccount, isAuthenticated, isLoading } = useCurrentAccount();
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
  const [tempUsername, setTempUsername] = useState('');
  const [tempEmail, setTempEmail] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    loadUserData();
  }, [isAuthenticated, currentAccount, router]);

  const loadUserData = async () => {
    if (!currentAccount) return;

    try {
      // Load user profile data
      const userDocRef = doc(db, 'users', currentAccount.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentUsername = userData.username || '';
        const currentEmail = currentAccount.email || '';
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

  const handleUsernameChange = async (newUsername: string) => {
    if (!currentAccount) return;
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
      await addUsername(currentAccount.uid, newUsername);

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
    if (!currentAccount) return;
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
      {/* Mobile Header */}
      <div className="lg:hidden">
        <div className="flex items-center px-4 py-3 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/settings')}
            className="mr-3"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Profile</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Desktop Header */}
        <div className="hidden lg:block mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your personal information</p>
        </div>

        {/* Profile Section */}
        <Card className="wewrite-card">
          <CardHeader className="pb-6">
            <CardTitle className="text-xl font-semibold">Profile Information</CardTitle>
            <CardDescription className="text-muted-foreground">
              Update your username and email
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