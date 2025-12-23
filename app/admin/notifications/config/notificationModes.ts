import { NotificationModes } from '../types';

/**
 * Notification modes for each template - which delivery methods are ACTUALLY implemented
 *
 * - email: Email is the primary delivery method for all templates
 * - inApp: In-app notifications stored in Firebase and shown in /notifications page
 * - push: PWA push notifications (service worker based)
 */
export const notificationModes: Record<string, NotificationModes> = {
  'verification': { email: true, inApp: false, push: false },
  'verification-reminder': { email: true, inApp: false, push: false },
  'welcome': { email: true, inApp: false, push: false },
  'password-reset': { email: true, inApp: false, push: false },
  'generic-notification': { email: true, inApp: false, push: false },
  'payout-setup-reminder': { email: true, inApp: false, push: false },
  'payout-processed': { email: true, inApp: true, push: false }, // Has in-app notification
  'subscription-confirmation': { email: true, inApp: false, push: false },
  'weekly-digest': { email: true, inApp: false, push: false },
  'new-follower': { email: true, inApp: true, push: false }, // Has in-app notification
  'page-linked': { email: true, inApp: true, push: false }, // Has in-app notification
  'account-security': { email: true, inApp: false, push: false },
  'choose-username': { email: true, inApp: false, push: false },
  'first-page-activation': { email: true, inApp: false, push: false },
  'reactivation': { email: true, inApp: false, push: false },
  'broadcast': { email: true, inApp: true, push: false }, // Has in-app notification for system announcements
  'product-update': { email: true, inApp: false, push: false },
};
