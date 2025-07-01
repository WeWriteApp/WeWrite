"use client";

import { auth } from '../firebase/auth';
import { createEmailVerificationNotification } from '../firebase/notifications';

/**
 * Email Verification Notification Service
 * 
 * Manages when and how email verification notifications are sent to users
 */

// Local storage key for tracking notification dismissals
const DISMISSED_KEY = 'email_verification_notification_dismissed';
const LAST_NOTIFICATION_KEY = 'last_email_verification_notification';

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
  } catch (error) {
    console.error('Error clearing dismissed status:', error);
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
    if (!session) return false;
    
    const notificationId = await createEmailVerificationNotification(session.uid);
    
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