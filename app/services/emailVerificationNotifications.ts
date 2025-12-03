"use client";

import { auth } from '../firebase/auth';
import { createEmailVerificationNotification } from '../services/notificationsApi';

/**
 * Email Verification Notification Service
 * 
 * Manages when and how email verification notifications are sent to users
 */

// Local storage key for tracking notification dismissals
const DISMISSED_KEY = 'email_verification_notification_dismissed';
const LAST_NOTIFICATION_KEY = 'last_email_verification_notification';
const RESEND_COOLDOWN_KEY = 'email_verification_resend_cooldown';
const RESEND_COUNT_KEY = 'email_verification_resend_count';

/**
 * Check if the user has dismissed email verification notifications
 */
export const hasUserDismissedNotifications = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    return dismissed === 'true';
  } catch (error) {
    console.error('Error checking dismissed notifications:', error);
    return false;
  }
};

/**
 * Mark email verification notifications as dismissed by the user
 */
export const dismissEmailVerificationNotifications = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(DISMISSED_KEY, 'true');
  } catch (error) {
    console.error('Error dismissing notifications:', error);
  }
};

/**
 * Clear the dismissed status (useful when user changes email)
 */
export const clearDismissedStatus = (): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(DISMISSED_KEY);
    localStorage.removeItem(LAST_NOTIFICATION_KEY);
    localStorage.removeItem(RESEND_COOLDOWN_KEY);
    localStorage.removeItem(RESEND_COUNT_KEY);
  } catch (error) {
    console.error('Error clearing dismissed status:', error);
  }
};

/**
 * Get the current resend cooldown remaining time in seconds
 */
export const getResendCooldownRemaining = (): number => {
  if (typeof window === 'undefined') return 0;

  try {
    const cooldownData = localStorage.getItem(RESEND_COOLDOWN_KEY);
    if (!cooldownData) return 0;

    const { expiresAt } = JSON.parse(cooldownData);
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));

    // Clean up expired cooldown
    if (remaining === 0) {
      localStorage.removeItem(RESEND_COOLDOWN_KEY);
    }

    return remaining;
  } catch (error) {
    console.error('Error getting resend cooldown:', error);
    return 0;
  }
};

/**
 * Check if resend is currently allowed
 */
export const canResendVerificationEmail = (): boolean => {
  return getResendCooldownRemaining() === 0;
};

/**
 * Start a resend cooldown period
 * First resend: 60 seconds, subsequent resends: 5 minutes (300 seconds)
 */
export const startResendCooldown = (): void => {
  if (typeof window === 'undefined') return;

  try {
    // Get current resend count
    const countData = localStorage.getItem(RESEND_COUNT_KEY);
    const currentCount = countData ? parseInt(countData, 10) : 0;
    const newCount = currentCount + 1;

    // Determine cooldown duration
    const cooldownSeconds = newCount === 1 ? 60 : 300; // 60s first time, 5min after
    const expiresAt = Date.now() + (cooldownSeconds * 1000);

    // Store cooldown data
    localStorage.setItem(RESEND_COOLDOWN_KEY, JSON.stringify({ expiresAt }));
    localStorage.setItem(RESEND_COUNT_KEY, newCount.toString());

    console.log(`Email verification resend cooldown started: ${cooldownSeconds}s (attempt ${newCount})`);
  } catch (error) {
    console.error('Error starting resend cooldown:', error);
  }
};

/**
 * Check if enough time has passed since the last notification
 */
const shouldCreateNotificationBasedOnTime = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const lastNotification = localStorage.getItem(LAST_NOTIFICATION_KEY);
    if (!lastNotification) return true;
    
    const lastTime = new Date(lastNotification);
    const now = new Date();
    const hoursSinceLastNotification = (now.getTime() - lastTime.getTime()) / (1000 * 60 * 60);
    
    // Only create notification if it's been more than 24 hours
    return hoursSinceLastNotification >= 24;
  } catch (error) {
    console.error('Error checking notification timing:', error);
    return true; // If there's an error, allow creating the notification
  }
};

/**
 * Record that we've created a notification
 */
const recordNotificationCreated = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(LAST_NOTIFICATION_KEY, new Date().toISOString());
  } catch (error) {
    console.error('Error recording notification creation:', error);
  }
};

/**
 * Check if the user needs email verification and should receive a notification
 */
export const shouldCreateEmailVerificationNotification = (): boolean => {
  // Check if user is authenticated
  if (!auth.currentUser) return false;
  
  // Check if email is already verified
  if (auth.currentUser.emailVerified) return false;
  
  // Check if user has dismissed notifications
  if (hasUserDismissedNotifications()) return false;
  
  // Check if enough time has passed since last notification
  if (!shouldCreateNotificationBasedOnTime()) return false;
  
  return true;
};

/**
 * Create an email verification notification if conditions are met
 */
export const createEmailVerificationNotificationIfNeeded = async (): Promise<boolean> => {
  try {
    if (!shouldCreateEmailVerificationNotification()) {
      return false;
    }
    
    const user = auth.currentUser;
    if (!user) return false;
    
    const notificationId = await createEmailVerificationNotification(user.uid);
    
    if (notificationId) {
      recordNotificationCreated();
      console.log('Email verification notification created:', notificationId);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error creating email verification notification:', error);
    return false;
  }
};

/**
 * Trigger points for email verification notifications
 */

/**
 * Check and create notification on app startup/login
 */
export const checkEmailVerificationOnStartup = async (): Promise<void> => {
  // Wait a bit to ensure auth state is settled
  setTimeout(async () => {
    await createEmailVerificationNotificationIfNeeded();
  }, 2000);
};

/**
 * Check and create notification when user tries to access restricted features
 */
export const checkEmailVerificationOnFeatureAccess = async (): Promise<void> => {
  await createEmailVerificationNotificationIfNeeded();
};

/**
 * Check and create notification periodically (e.g., when user navigates)
 */
export const checkEmailVerificationPeriodically = async (): Promise<void> => {
  // Only check periodically if user hasn't dismissed and it's been a while
  if (shouldCreateNotificationBasedOnTime()) {
    await createEmailVerificationNotificationIfNeeded();
  }
};

/**
 * Force create an email verification notification (for testing/admin purposes)
 */
export const forceCreateEmailVerificationNotification = async (): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!session) return false;

    // Skip all checks and force create the notification
    const notificationId = await createEmailVerificationNotification(session.uid);

    if (notificationId) {
      recordNotificationCreated();
      console.log('Email verification notification force created:', notificationId);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error force creating email verification notification:', error);
    return false;
  }
};