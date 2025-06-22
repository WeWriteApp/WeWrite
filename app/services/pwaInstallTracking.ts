import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/database/core';

export interface PWAInstallEvent {
  userId?: string;
  username?: string;
  timestamp: Date;
  eventType: 'install_prompt_shown' | 'install_accepted' | 'install_dismissed' | 'app_installed';
  userAgent: string;
  platform: string;
}

/**
 * PWA Installation Tracking Service
 * 
 * Tracks PWA installation events for analytics dashboard visualization.
 */
export class PWAInstallTrackingService {
  private static isInitialized = false;
  private static deferredPrompt: any = null;
  private static currentUserId?: string;
  private static currentUsername?: string;

  /**
   * Initialize PWA installation tracking
   */
  static initialize(userId?: string, username?: string): void {
    // Update current user context
    this.currentUserId = userId;
    this.currentUsername = username;

    if (this.isInitialized || typeof window === 'undefined') {
      // If already initialized, just update the user context
      console.log('📱 PWA tracking user context updated:', userId ? `${username} (${userId})` : 'anonymous');
      return;
    }

    this.isInitialized = true;

    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();

      // Store the event for later use
      this.deferredPrompt = e;

      // Track that the install prompt was shown using current user context
      this.trackInstallEvent('install_prompt_shown', this.currentUserId, this.currentUsername);

      console.log('📱 PWA install prompt available');
    });

    // Listen for appinstalled event
    window.addEventListener('appinstalled', () => {
      // Track successful installation using current user context
      this.trackInstallEvent('app_installed', this.currentUserId, this.currentUsername);

      // Clear the deferredPrompt
      this.deferredPrompt = null;

      console.log('📱 PWA was installed successfully');
    });

    console.log('📱 PWA installation tracking initialized');
  }

  /**
   * Show the PWA install prompt
   */
  static async showInstallPrompt(): Promise<boolean> {
    if (!this.deferredPrompt) {
      console.log('📱 No install prompt available');
      return false;
    }

    try {
      // Show the install prompt
      this.deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await this.deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        this.trackInstallEvent('install_accepted', this.currentUserId, this.currentUsername);
        console.log('📱 User accepted the install prompt');
        return true;
      } else {
        this.trackInstallEvent('install_dismissed', this.currentUserId, this.currentUsername);
        console.log('📱 User dismissed the install prompt');
        return false;
      }
    } catch (error) {
      console.error('📱 Error showing install prompt:', error);
      return false;
    } finally {
      // Clear the deferredPrompt
      this.deferredPrompt = null;
    }
  }

  /**
   * Check if PWA install prompt is available
   */
  static isInstallPromptAvailable(): boolean {
    return !!this.deferredPrompt;
  }

  /**
   * Track a PWA installation event
   */
  private static async trackInstallEvent(
    eventType: PWAInstallEvent['eventType'],
    userId?: string,
    username?: string
  ): Promise<void> {
    try {
      const installEvent: PWAInstallEvent = {
        userId,
        username,
        timestamp: new Date(),
        eventType,
        userAgent: navigator.userAgent,
        platform: this.getPlatform()
      };

      // Prepare data for Firestore - remove undefined values to prevent Firestore errors
      const firestoreData: any = {
        timestamp: Timestamp.fromDate(installEvent.timestamp),
        eventType: 'pwa_install',
        userAgent: installEvent.userAgent,
        platform: installEvent.platform
      };

      // Only add userId and username if they are defined
      if (userId) {
        firestoreData.userId = userId;
      }
      if (username) {
        firestoreData.username = username;
      }

      // Store in Firestore analytics collection
      const analyticsRef = collection(db, 'analytics_events');
      await addDoc(analyticsRef, firestoreData);

      console.log('📊 PWA install event tracked:', {
        eventType,
        userId: userId || 'anonymous',
        platform: installEvent.platform
      });

    } catch (error) {
      console.error('Error tracking PWA install event:', error);
      // Don't throw error to avoid disrupting the user experience
    }
  }

  /**
   * Get the current platform
   */
  private static getPlatform(): string {
    if (typeof window === 'undefined') {
      return 'unknown';
    }

    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('android')) {
      return 'android';
    } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      return 'ios';
    } else if (userAgent.includes('windows')) {
      return 'windows';
    } else if (userAgent.includes('mac')) {
      return 'macos';
    } else if (userAgent.includes('linux')) {
      return 'linux';
    } else {
      return 'unknown';
    }
  }

  /**
   * Check if the app is currently running as a PWA
   */
  static isPWA(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    // Check if running in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    // Check for iOS PWA
    const isIOSPWA = (window.navigator as any).standalone === true;
    
    return isStandalone || isIOSPWA;
  }

  /**
   * Get PWA installation statistics
   */
  static getInstallationStats(): {
    isPWA: boolean;
    isInstallPromptAvailable: boolean;
    platform: string;
  } {
    return {
      isPWA: this.isPWA(),
      isInstallPromptAvailable: this.isInstallPromptAvailable(),
      platform: this.getPlatform()
    };
  }
}
