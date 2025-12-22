"use client";

import { createNotification } from './notificationsApi';
import { isValidUsername } from '../hooks/useUsernameStatus';

/**
 * Username Setup Notification Service
 * 
 * Manages when and how username setup notifications are sent to users
 */

// Local storage keys for tracking notification state
const STORAGE_KEYS = {
  DISMISSED: 'username_setup_notification_dismissed',
  LAST_NOTIFICATION: 'last_username_setup_notification',
  EMAIL_SENT: 'username_setup_email_sent',
};

/**
 * Check if the user has dismissed username setup notifications
 */
export const hasUserDismissedUsernameNotifications = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const dismissed = localStorage.getItem(STORAGE_KEYS.DISMISSED);
    return dismissed === 'true';
  } catch (error) {
    console.error('Error checking dismissed username notifications:', error);
    return false;
  }
};

/**
 * Mark username setup notifications as dismissed by the user
 */
export const dismissUsernameSetupNotifications = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEYS.DISMISSED, 'true');
  } catch (error) {
    console.error('Error dismissing username notifications:', error);
  }
};

/**
 * Clear the dismissed status (reset notification preferences)
 */
export const clearUsernameNotificationStatus = (): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEYS.DISMISSED);
    localStorage.removeItem(STORAGE_KEYS.LAST_NOTIFICATION);
    localStorage.removeItem(STORAGE_KEYS.EMAIL_SENT);
  } catch (error) {
    console.error('Error clearing username notification status:', error);
  }
};

/**
 * Check if enough time has passed since the last notification (7 days)
 */
const shouldCreateNotificationBasedOnTime = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const lastNotification = localStorage.getItem(STORAGE_KEYS.LAST_NOTIFICATION);
    if (!lastNotification) return true;
    
    const lastTime = new Date(lastNotification);
    const now = new Date();
    const daysSinceLastNotification = (now.getTime() - lastTime.getTime()) / (1000 * 60 * 60 * 24);
    
    // Only create notification if it's been more than 7 days
    return daysSinceLastNotification >= 7;
  } catch (error) {
    console.error('Error checking notification timing:', error);
    return true;
  }
};

/**
 * Record that we've created a notification
 */
const recordNotificationCreated = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_NOTIFICATION, new Date().toISOString());
  } catch (error) {
    console.error('Error recording notification creation:', error);
  }
};

/**
 * Check if we've already sent a username setup email
 */
export const hasUsernameSetupEmailBeenSent = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    return localStorage.getItem(STORAGE_KEYS.EMAIL_SENT) === 'true';
  } catch (error) {
    return false;
  }
};

/**
 * Mark that the username setup email has been sent
 */
export const markUsernameSetupEmailSent = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEYS.EMAIL_SENT, 'true');
  } catch (error) {
    console.error('Error marking email as sent:', error);
  }
};

interface UserData {
  uid: string;
  username?: string | null;
  email?: string | null;
}

/**
 * Check if the user needs a username setup notification
 */
export const shouldCreateUsernameSetupNotification = (user: UserData | null): boolean => {
  if (!user) return false;
  
  // Check if user has a valid username
  if (isValidUsername(user.username)) return false;
  
  // Check if user has dismissed notifications
  if (hasUserDismissedUsernameNotifications()) return false;
  
  // Check if enough time has passed since last notification
  if (!shouldCreateNotificationBasedOnTime()) return false;
  
  return true;
};

/**
 * Create a username setup notification for the user
 */
export const createUsernameSetupNotification = async (userId: string): Promise<string | null> => {
  try {
    const notificationId = await createNotification({
      userId,
      type: 'username_setup',
      title: 'Choose your username',
      message: 'Stand out on WeWrite! Set up your username to build your identity as a writer.',
      actionUrl: '/settings/profile',
      criticality: 'normal',
    });
    
    return notificationId;
  } catch (error) {
    console.error('Error creating username setup notification:', error);
    return null;
  }
};

/**
 * Create a username setup notification if conditions are met
 */
export const createUsernameSetupNotificationIfNeeded = async (user: UserData | null): Promise<boolean> => {
  try {
    if (!shouldCreateUsernameSetupNotification(user)) {
      return false;
    }
    
    if (!user) return false;
    
    const notificationId = await createUsernameSetupNotification(user.uid);
    
    if (notificationId) {
      recordNotificationCreated();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error creating username setup notification:', error);
    return false;
  }
};

/**
 * Send username setup email via API
 */
export const sendUsernameSetupEmail = async (userId: string, email: string, currentUsername?: string): Promise<boolean> => {
  try {
    // Don't send if already sent
    if (hasUsernameSetupEmailBeenSent()) {
      return false;
    }
    
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateId: 'choose-username',
        to: email,
        data: {
          currentUsername: currentUsername || 'user_...',
        },
      }),
    });
    
    if (response.ok) {
      markUsernameSetupEmailSent();
      return true;
    } else {
      const error = await response.json();
      console.error('Failed to send username setup email:', error);
      return false;
    }
  } catch (error) {
    console.error('Error sending username setup email:', error);
    return false;
  }
};
