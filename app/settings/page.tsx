'use client';

import { useState, useEffect } from 'react';
import { useAuth } from "../providers/AuthProvider";
import { getUserSubscription } from "../firebase/subscription";
import { doc, getDoc } from "firebase/firestore";
import { addUsername, updateEmail as updateFirebaseEmail, checkUsernameAvailability } from "../firebase/auth";
import { db } from "../firebase/database";
import { validateUsernameFormat, getUsernameErrorMessage } from '../utils/usernameValidation';
import { useRouter } from 'next/navigation';

import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { PayoutsManager } from '../components/payments/PayoutsManager';
import { CombinedSubscriptionSection } from '../components/payments/CombinedSubscriptionSection';
import PWAInstallationCard from '../components/utils/PWAInstallationCard';
import { SyncQueueSettings } from '../components/utils/SyncQueueSettings';
import { EmailVerificationStatus } from '../components/utils/EmailVerificationStatus';

import { ChevronLeft, Edit3, Save, X, CheckCircle, AlertCircle, Clock } from 'lucide-react';

// Define admin check locally to avoid import issues
const isAdmin = (userEmail?: string | null): boolean => {
  if (!userEmail) return false;
  return userEmail === 'jamiegray2234@gmail.com';
};


export default function AccountPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Edit state management
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [tempEmail, setTempEmail] = useState('');

  // Feature flag state
  const [isPaymentsEnabled, setIsPaymentsEnabled] = useState(false);



  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    loadUserData();

    // Check payments feature flag when user is available
    const checkFeatureFlag = async () => {
      try {
        const { isFeatureEnabledForUser } = await import('../utils/feature-flags');
        const enabled = await isFeatureEnabledForUser('payments', user.uid);
        setIsPaymentsEnabled(enabled);
      } catch (error) {
        console.error('Error checking payments feature flag:', error);
        setIsPaymentsEnabled(false);
      }
    };

    checkFeatureFlag();
  }, [user, router]);

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

      // Load subscription data
      const userSubscription = await getUserSubscription(user.uid);
      if (userSubscription && typeof userSubscription === 'object' && 'status' in userSubscription && userSubscription.status === 'active') {
        fetchPaymentHistory(user.uid);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const fetchPaymentHistory = async (userId: string) => {
    if (!userId) return;

    try {
      setIsLoadingHistory(true);

      // Fetch payment history from Stripe
      const response = await fetch(`/api/payment-history?userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch payment history: ${response.status}`);
      }

      const data = await response.json();
      setPaymentHistory(data.payments || []);
    } catch (error) {
      console.error('Error fetching payment history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleUsernameChange = async (newUsername: string) => {
    if (!user) return;
    if (!newUsername || newUsername === username) return;

    // Validate username format first
    const formatValidation = validateUsernameFormat(newUsername);
    if (!formatValidation.isValid) {
      alert(`Invalid username: ${formatValidation.message}`);
      return;
    }

    try {
      setLoading(true);

      // Check username availability
      const availabilityResult = await checkUsernameAvailability(newUsername);

      if (typeof availabilityResult === 'object' && !availabilityResult.isAvailable) {
        alert(`Username not available: ${availabilityResult.message}`);
        return;
      } else if (typeof availabilityResult === 'boolean' && !availabilityResult) {
        alert('Username is already taken. Please choose a different username.');
        return;
      }

      // Add username to user profile
      await addUsername(user.uid, newUsername);

      // Update local state
      setUsername(newUsername);

      // Show success message
      alert('Username updated successfully!');
    } catch (error) {
      console.error('Error updating username:', error);
      alert(`Failed to update username: ${error.message}`);
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
      alert('Email updated successfully!');
    } catch (error) {
      console.error('Error updating email:', error);
      setEmailError(error.message || 'Failed to update email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/')}
            className="mr-4 shadow-sm"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
          </div>
        </div>

        {user && (
          <div className="space-y-8">
          {/* Profile Section */}
          <section>
            <Card className="wewrite-card">
              <CardHeader className="pb-6">
                <CardTitle className="text-xl font-semibold">Profile</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Manage your personal information and account settings
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
                    <div className="flex items-center gap-2 mt-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <p className="text-sm text-red-700 dark:text-red-300">{emailError}</p>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-6 border-t border-border/50">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
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

                    if (confirm(confirmMessage)) {
                      // Import and call the logout function with appropriate parameters
                      import('../firebase/auth').then(({ logoutUser }) => {
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
          </section>



          {/* Payment-related sections - Only visible when payments feature flag is enabled */}
          {user && user.email && isPaymentsEnabled && (
            <div className="space-y-8">
              {/* Combined Subscription Section (includes Payment Methods, Subscription, and Pledges) */}
              <CombinedSubscriptionSection />

              {/* Standalone Payouts Section */}
              <PayoutsManager />
            </div>
          )}



          {/* Account Settings - Always visible */}
          <div className="space-y-8">
            {/* Sync Queue Settings */}
            <SyncQueueSettings />

            {/* PWA Installation */}
            <PWAInstallationCard />
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
