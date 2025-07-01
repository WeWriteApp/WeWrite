"use client";

import { useRouter } from 'next/navigation';
import { Button } from '../../components/ui/button';
import { X } from 'lucide-react';

export default function ReturnToPreviousAccount(): JSX.Element | null {
  const router = useRouter();
  const isAddingAccount = typeof window !== 'undefined' &&
    (sessionStorage.getItem('wewrite_adding_account') === 'true');
  const returnUrl = typeof window !== 'undefined' ?
    sessionStorage.getItem('wewrite_return_url') : null;

  // Function to return to the previous account/page
  const handleReturn = (): void => {
    // Clear the adding account flag
    sessionStorage.removeItem('wewrite_adding_account');
    sessionStorage.removeItem('wewrite_return_url');
    localStorage.removeItem('addingNewAccount');

    // Get the previous user data
    const previousUserData = sessionStorage.getItem('wewrite_previous_user');
    const previousUserSession = localStorage.getItem('previousUserSession');

    if (previousUserSession) {
      // Restore the previous user account
      localStorage.setItem('currentUser', previousUserSession);

      // Navigate back to the return URL or home page
      if (returnUrl) {
        window.location.href = returnUrl; // Use window.location for full page reload
      } else {
        window.location.href = '/'; // Use window.location for full page reload
      }
    } else {
      // If no previous session, just navigate back
      if (returnUrl) {
        router.push(returnUrl);
      } else {
        router.push('/');
      }
    }
  };

  // If not adding an account, don't show anything
  if (!isAddingAccount) {
    return null;
  }

  return (
    <div className="absolute top-4 left-4 z-50">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleReturn}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
        <span>Cancel account switch</span>
      </Button>
    </div>
  );
}