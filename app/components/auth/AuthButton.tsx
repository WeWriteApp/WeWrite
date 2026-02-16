"use client";

import React from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import { Button } from '../ui/button';
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { ANALYTICS_EVENTS } from '../../constants/analytics-events';

interface AuthButtonProps {
  type: 'login' | 'register';
  variant?: 'default' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  device?: string;
  children?: React.ReactNode;
}

/**
 * Reusable authentication button component
 * Handles analytics tracking and navigation consistently
 */
export function AuthButton({
  type,
  variant = 'secondary',
  size = 'default',
  className = '',
  device = 'unknown',
  children
}: AuthButtonProps) {
  const analytics = useWeWriteAnalytics();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Preserve referral code when navigating to register page
  const refParam = searchParams.get('ref');

  // Detect referral source from landing page URL (e.g., /welcome/writers -> writers)
  const getReferralSource = () => {
    if (pathname?.startsWith('/welcome/')) {
      const source = pathname.replace('/welcome/', '');
      return source || 'general';
    }
    if (pathname === '/welcome') {
      return 'general';
    }
    return undefined;
  };

  const source = getReferralSource();

  // Build register URL with query params
  const buildRegisterUrl = () => {
    const params = new URLSearchParams();
    if (refParam) params.set('ref', refParam);
    if (source) params.set('source', source);
    const queryString = params.toString();
    return queryString ? `/auth/register?${queryString}` : '/auth/register';
  };

  const config = {
    login: {
      href: '/auth/login',
      text: 'Sign In',
      label: `${device} sign-in button`
    },
    register: {
      href: buildRegisterUrl(),
      text: 'Sign Up',
      label: `${device} sign-up button`
    }
  };

  const { href, text, label } = config[type];
  const displayText = children || text;
  
  const handleClick = () => {
    
    try {
      analytics.trackInteractionEvent(ANALYTICS_EVENTS.LINK_CLICKED, {
        label,
        link_type: 'auth',
        link_text: displayText,
        link_url: href,
        device
      });
    } catch (error) {
      console.error('Analytics error:', error);
    }
  };
  
  return (
    <Button variant={variant} size={size} className={className} asChild>
      <Link href={href} onClick={handleClick}>
        {displayText}
      </Link>
    </Button>
  );
}
