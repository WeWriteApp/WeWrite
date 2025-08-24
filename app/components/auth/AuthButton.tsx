"use client";

import React from 'react';
import Link from 'next/link';
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
  
  const config = {
    login: {
      href: '/auth/login',
      text: 'Sign In',
      label: `${device} sign-in button`
    },
    register: {
      href: '/auth/register', 
      text: 'Sign Up',
      label: `${device} sign-up button`
    }
  };
  
  const { href, text, label } = config[type];
  const displayText = children || text;
  
  const handleClick = () => {
    console.log(`🟠 ${label} clicked`);
    
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
