/**
 * Email Verification Page
 * 
 * Handles verification when user clicks the link from our custom Resend email.
 * Validates the token and marks the user's email as verified.
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useSearchParams, useRouter } from 'next/navigation';
import { auth } from '../../firebase/config';
import { useAuth } from '../../providers/AuthProvider';
import { ModernAuthLayout } from '../../components/layout/modern-auth-layout';
import Link from 'next/link';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    const verifyEmail = async () => {
      try {
        // Call our API to verify the token
        const response = await fetch('/api/auth/verify-email-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.error === 'TOKEN_EXPIRED') {
            setStatus('expired');
            setMessage('This verification link has expired. Please request a new one.');
          } else if (data.error === 'TOKEN_ALREADY_USED') {
            setStatus('success');
            setMessage('Your email has already been verified!');
          } else {
            setStatus('error');
            setMessage(data.error || 'Failed to verify email');
          }
          return;
        }

        setStatus('success');
        setMessage('Your email has been verified successfully!');

        // Refresh user context to get updated email verification status
        if (refreshUser) {
          await refreshUser();
        }

        // Redirect to home after a short delay
        setTimeout(() => {
          router.push('/home');
        }, 3000);
      } catch (error) {
        console.error('[Verify Email] Error:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    verifyEmail();
  }, [searchParams, router, refreshUser]);

  const handleResendVerification = async () => {
    if (!user?.email) {
      setMessage('Please log in to resend verification email');
      return;
    }

    setStatus('loading');
    setMessage('Sending new verification email...');

    try {
      const idToken = await auth.currentUser?.getIdToken();
      
      const response = await fetch('/api/email/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          userId: user.uid,
          username: user.username,
          idToken,
        }),
      });

      if (response.ok) {
        setStatus('success');
        setMessage('A new verification email has been sent. Please check your inbox.');
      } else {
        setStatus('error');
        setMessage('Failed to send verification email. Please try again.');
      }
    } catch (error) {
      console.error('[Verify Email] Resend error:', error);
      setStatus('error');
      setMessage('Failed to send verification email. Please try again.');
    }
  };

  return (
    <ModernAuthLayout
      title={status === 'success' ? 'Email Verified!' : 'Verifying Email'}
      description="Please wait while we verify your email address"
    >
      <div className="text-center flex flex-col items-center gap-6">
        {status === 'loading' && (
          <>
            <Icon name="Loader" className="mx-auto mb-4" />
            <p className="text-foreground/70">Verifying your email address...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <Icon name="CheckCircle" size={64} className="text-green-500 mx-auto mb-4" />
            <p className="text-foreground font-medium mb-2">{message}</p>
            <p className="text-foreground/70 text-sm">Redirecting you to the home page...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <Icon name="XCircle" size={64} className="text-red-500 mx-auto mb-4" />
            <p className="text-foreground font-medium mb-4">{message}</p>
            <Link
              href="/"
              className="inline-block px-6 py-2 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors"
            >
              Go to Home
            </Link>
          </>
        )}

        {status === 'expired' && (
          <>
            <Icon name="XCircle" size={64} className="text-yellow-500 mx-auto mb-4" />
            <p className="text-foreground font-medium mb-4">{message}</p>
            {user ? (
              <button
                onClick={handleResendVerification}
                className="inline-block px-6 py-2 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors"
              >
                Send New Verification Email
              </button>
            ) : (
              <Link
                href="/auth/login"
                className="inline-block px-6 py-2 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors"
              >
                Log In to Resend
              </Link>
            )}
          </>
        )}
      </div>
    </ModernAuthLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <ModernAuthLayout
          title="Verifying Email"
          description="Please wait while we verify your email address"
        >
          <div className="flex flex-col items-center gap-6">
            <Icon name="Loader" className="mx-auto" />
            <p className="text-foreground/70">Loading...</p>
          </div>
        </ModernAuthLayout>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
