"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setCurrentUser } from "../../utils/currentUser";

export default function SwitchAccountPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const switchAccount = () => {
      try {
        // Get the account to switch to from localStorage
        const switchToAccountJson = localStorage.getItem('switchToAccount');

        if (!switchToAccountJson) {
          setError('No account to switch to found');
          setTimeout(() => router.push('/'), 1000);
          return;
        }

        const switchToAccount = JSON.parse(switchToAccountJson);
        console.log('Switching to account:', switchToAccount.username || switchToAccount.email);

        // Make sure the account is marked as current
        switchToAccount.isCurrent = true;

        // Use the centralized utility to set the current user
        setCurrentUser(switchToAccount);

        // Clean up the localStorage
        localStorage.removeItem('switchToAccount');

        // Immediately redirect to home page
        window.location.href = '/';
      } catch (error) {
        console.error('Error switching account:', error);
        setError('Error switching account. Please try again.');
        setTimeout(() => router.push('/'), 1000);
      }
    };

    switchAccount();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Switching Account...</h1>
        <p className="text-muted-foreground mb-4">
          Please wait while we switch your account.
        </p>
        {error && (
          <p className="text-red-500 mt-4">{error}</p>
        )}
      </div>
    </div>
  );
}
