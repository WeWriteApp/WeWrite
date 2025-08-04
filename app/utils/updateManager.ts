/**
 * Global Update Manager
 * 
 * Coordinates all update detection systems to prevent duplicate modals
 * and ensure updates are only shown once per version.
 */

interface UpdateState {
  buildId: string;
  timestamp: number;
  dismissed: boolean;
  shown: boolean;
}

class UpdateManager {
  private static instance: UpdateManager;
  private currentBuildId: string | null = null;
  private updateStates = new Map<string, UpdateState>();
  private listeners = new Set<(hasUpdate: boolean) => void>();

  private constructor() {
    // Only initialize on client-side
    if (typeof window !== 'undefined') {
      this.loadFromStorage();
      this.detectCurrentBuild();
    }
  }

  static getInstance(): UpdateManager {
    if (!UpdateManager.instance) {
      UpdateManager.instance = new UpdateManager();
    }
    return UpdateManager.instance;
  }

  /**
   * Detect current build ID from various sources
   */
  private detectCurrentBuild(): void {
    // Only run on client-side
    if (typeof window === 'undefined') return;

    // Try to get build ID from meta tag
    const metaBuildId = document.querySelector('meta[name="build-id"]')?.getAttribute('content');
    if (metaBuildId) {
      this.currentBuildId = metaBuildId;
      return;
    }

    // Try to get from localStorage (set by build process)
    const storedBuildId = localStorage.getItem('currentBuildId');
    if (storedBuildId) {
      this.currentBuildId = storedBuildId;
      return;
    }

    // Fallback: use timestamp-based ID
    this.currentBuildId = Date.now().toString();
    localStorage.setItem('currentBuildId', this.currentBuildId);
  }

  /**
   * Load update states from localStorage
   */
  private loadFromStorage(): void {
    // Only run on client-side
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('updateStates');
      if (stored) {
        const states = JSON.parse(stored);
        this.updateStates = new Map(Object.entries(states));
      }
    } catch (error) {
      console.warn('Failed to load update states:', error);
    }
  }

  /**
   * Save update states to localStorage
   */
  private saveToStorage(): void {
    // Only run on client-side
    if (typeof window === 'undefined') return;

    try {
      const states = Object.fromEntries(this.updateStates.entries());
      localStorage.setItem('updateStates', JSON.stringify(states));
    } catch (error) {
      console.warn('Failed to save update states:', error);
    }
  }

  /**
   * Check if a new build is available
   */
  checkForUpdate(newBuildId: string): boolean {
    if (!this.currentBuildId || !newBuildId) return false;
    
    // Same build, no update
    if (newBuildId === this.currentBuildId) return false;

    // Check if this update was already handled
    const updateState = this.updateStates.get(newBuildId);
    if (updateState?.dismissed || updateState?.shown) {
      return false;
    }

    // New update detected
    console.log('🔄 Update detected by UpdateManager:', {
      current: this.currentBuildId,
      new: newBuildId
    });

    return true;
  }

  /**
   * Mark an update as shown
   */
  markUpdateShown(buildId: string): void {
    const state = this.updateStates.get(buildId) || {
      buildId,
      timestamp: Date.now(),
      dismissed: false,
      shown: false
    };

    state.shown = true;
    this.updateStates.set(buildId, state);
    this.saveToStorage();

    console.log('📱 Update modal shown for build:', buildId);
  }

  /**
   * Mark an update as dismissed
   */
  markUpdateDismissed(buildId: string): void {
    const state = this.updateStates.get(buildId) || {
      buildId,
      timestamp: Date.now(),
      dismissed: false,
      shown: false
    };

    state.dismissed = true;
    this.updateStates.set(buildId, state);
    this.saveToStorage();

    // Also set legacy dismissal keys for backward compatibility (client-side only)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`updateDismissed_${buildId}`, Date.now().toString());
      localStorage.setItem('updateDismissedAt', Date.now().toString());
    }

    console.log('🔕 Update dismissed for build:', buildId);

    // Notify listeners
    this.notifyListeners(false);
  }

  /**
   * Handle successful refresh/update
   */
  markUpdateApplied(buildId: string): void {
    // Clear the update state since it's been applied
    this.updateStates.delete(buildId);
    this.currentBuildId = buildId;

    // Only update localStorage on client-side
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentBuildId', buildId);
    }

    this.saveToStorage();

    console.log('✅ Update applied for build:', buildId);

    // Notify listeners
    this.notifyListeners(false);
  }

  /**
   * Check if update should be shown
   */
  shouldShowUpdate(buildId: string): boolean {
    if (!this.checkForUpdate(buildId)) return false;

    const state = this.updateStates.get(buildId);
    
    // Don't show if already dismissed or shown
    if (state?.dismissed || state?.shown) return false;

    // Check if recently dismissed (within 1 hour) - client-side only
    if (typeof window !== 'undefined') {
      const dismissedAt = localStorage.getItem('updateDismissedAt');
      if (dismissedAt) {
        const dismissedTime = parseInt(dismissedAt);
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - dismissedTime < oneHour) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Register for update notifications
   */
  onUpdateAvailable(callback: (hasUpdate: boolean) => void): () => void {
    this.listeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(hasUpdate: boolean): void {
    this.listeners.forEach(callback => {
      try {
        callback(hasUpdate);
      } catch (error) {
        console.error('Error in update listener:', error);
      }
    });
  }

  /**
   * Clean up old update states (older than 7 days)
   */
  cleanup(): void {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [buildId, state] of this.updateStates.entries()) {
      if (state.timestamp < sevenDaysAgo) {
        this.updateStates.delete(buildId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.saveToStorage();
      console.log(`🧹 Cleaned up ${cleaned} old update states`);
    }
  }

  /**
   * Get current state for debugging
   */
  getState(): any {
    return {
      currentBuildId: this.currentBuildId,
      updateStates: Object.fromEntries(this.updateStates.entries()),
      listeners: this.listeners.size
    };
  }

  /**
   * Reset all update states (for debugging)
   */
  reset(): void {
    this.updateStates.clear();

    // Only clear localStorage on client-side
    if (typeof window !== 'undefined') {
      localStorage.removeItem('updateStates');
      localStorage.removeItem('updateDismissedAt');

      // Clear all build-specific dismissals
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('updateDismissed_')) {
          localStorage.removeItem(key);
        }
      }
    }

    console.log('🔄 Update manager reset');
  }
}

// Export singleton instance
export const updateManager = UpdateManager.getInstance();

// Convenience functions
export const checkForUpdate = (buildId: string) => updateManager.checkForUpdate(buildId);
export const shouldShowUpdate = (buildId: string) => updateManager.shouldShowUpdate(buildId);
export const markUpdateShown = (buildId: string) => updateManager.markUpdateShown(buildId);
export const markUpdateDismissed = (buildId: string) => updateManager.markUpdateDismissed(buildId);
export const markUpdateApplied = (buildId: string) => updateManager.markUpdateApplied(buildId);

// Auto-cleanup on load
if (typeof window !== 'undefined') {
  updateManager.cleanup();
}
