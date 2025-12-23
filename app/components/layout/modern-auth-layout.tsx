"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Icon } from '@/components/ui/Icon';

interface ModernAuthLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  showLogo?: boolean;
  showTerms?: boolean;
}

export function ModernAuthLayout({
  children,
  title,
  description,
  showLogo = true,
  showTerms = true
}: ModernAuthLayoutProps) {
  // Note: Blob background is now rendered globally via GlobalLandingBlobs in root layout
  // This ensures blobs persist across page transitions between landing and auth pages
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 md:p-10 bg-background relative overflow-hidden">

        {/* Content */}
        <div className="w-full max-w-md mx-auto relative z-10">
          {/* Back to landing page link */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <Icon name="ArrowLeft" size={16} />
            Back to landing page
          </Link>

          <div className="wewrite-card rounded-xl p-6 md:p-8">
            {children}
          </div>

          {/* Terms and privacy policy below the card */}
          {showTerms && (
            <div className="text-xs text-muted-foreground text-center mt-6">
              By using WeWrite you agree to our{' '}
              <Link
                href="https://github.com/WeWriteApp/WeWrite/blob/main/docs/TERMS_OF_SERVICE.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Terms of Service
              </Link>
              {' '}and{' '}
              <Link
                href="https://github.com/WeWriteApp/WeWrite/blob/main/docs/PRIVACY_POLICY.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Privacy Policy
              </Link>
            </div>
          )}
        </div>
      </div>
  );
}