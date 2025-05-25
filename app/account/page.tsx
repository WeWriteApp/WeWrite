'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { getUserSubscription } from '../firebase/subscription';
import { doc, getDoc } from 'firebase/firestore';
import { addUsername, updateEmail as updateFirebaseEmail } from '../firebase/auth';
import { db } from '../firebase/database';
import { useRouter } from 'next/navigation';

import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import SubscriptionManagement from '../components/SubscriptionManagement';
import { PaymentMethodsManager } from '../components/PaymentMethodsManager';
import PWAInstallationCard from '../components/PWAInstallationCard';
import { useFeatureFlag } from '../utils/feature-flags';

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
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    loadUserData();
  }, [user, router]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      // Load user profile data
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUsername(userData.username || '');
        setEmail(user.email || '');
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

    try {
      setLoading(true);

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
    <div className="px-5 py-6 max-w-3xl mx-auto">
      <div className="flex items-center mb-8">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/')}
          className="mr-4"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Account Settings</h1>
      </div>

      {user && (
        <div className="space-y-6">
          {/* Profile Section */}
          <section>
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Manage your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Username</label>
                  <div className="flex justify-between items-center">
                    <p className="text-foreground">{username || 'No username set'}</p>
                    <button
                      onClick={() => {
                        const newUsername = prompt("Enter new username:", username);
                        if (newUsername) handleUsernameChange(newUsername);
                      }}
                      className="text-sm text-foreground/60 hover:text-foreground"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Email</label>
                  <div className="flex justify-between items-center">
                    <p className="text-foreground">{email}</p>
                    <button
                      onClick={() => {
                        const newEmail = prompt("Enter new email:", email);
                        if (newEmail) handleEmailChange(newEmail);
                      }}
                      className="text-sm text-foreground/60 hover:text-foreground"
                    >
                      Edit
                    </button>
                  </div>
                  {emailError && (
                    <p className="text-sm text-red-500 mt-1">{emailError}</p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-end pt-4 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm("Are you sure you want to log out?")) {
                      // Import and call the logout function
                      import('../firebase/auth').then(({ logoutUser }) => {
                        logoutUser().then(() => {
                          router.push('/');
                        });
                      });
                    }
                  }}
                >
                  Logout
                </Button>
              </CardFooter>
            </Card>
          </section>

          {/* Subscription Management Section - Only visible when subscription feature flag is enabled */}
          {user && user.email && useFeatureFlag('subscription_management', user.email) && (
            <section>
              <SubscriptionManagement />

              {/* Payment Methods Section */}
              <div className="mt-6">
                <PaymentMethodsManager />
              </div>

              {/* Payment History */}
              {paymentHistory.length > 0 && (
                <div className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Payment History</CardTitle>
                      <CardDescription>Your recent subscription payments</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoadingHistory ? (
                        <div className="py-4 flex justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary"></div>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {paymentHistory.map((payment, index) => (
                            <div key={index} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                              <div>
                                <p className="text-sm font-medium">${payment.amount.toFixed(2)}</p>
                                <p className="text-xs text-muted-foreground">{new Date(payment.created * 1000).toLocaleDateString()}</p>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full ${payment.status === 'succeeded' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100'}`}>
                                {payment.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </section>
          )}

          {/* When subscription feature is disabled, don't show any subscription UI */}

          {/* Admin Panel Link - Only visible for admins */}
          {user && user.email && isAdmin(user.email) && (
            <section>
              <Card>
                <CardHeader>
                  <CardTitle>Admin</CardTitle>
                  <CardDescription>Access administrative tools and settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Manage feature flags, admin users, and other administrative settings.
                  </p>
                  <Button
                    onClick={() => router.push('/admin')}
                    className="w-full"
                  >
                    Go to Admin Panel
                  </Button>
                </CardContent>
              </Card>
            </section>
          )}

          {/* PWA Installation Status Card */}
          <section>
            <PWAInstallationCard />
          </section>
        </div>
      )}
    </div>
  );
}
