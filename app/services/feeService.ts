/**
 * Fee Service for WeWrite
 * Handles fee structure management and real-time updates
 */

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface FeeStructure {
  platformFeePercentage: number;
  lastUpdated: Date;
  updatedBy: string;
}

class FeeService {
  private static instance: FeeService;
  private currentFeeStructure: FeeStructure | null = null;
  private listeners: ((feeStructure: FeeStructure) => void)[] = [];
  private unsubscribe: (() => void) | null = null;

  private constructor() {
    this.initializeListener();
  }

  public static getInstance(): FeeService {
    if (!FeeService.instance) {
      FeeService.instance = new FeeService();
    }
    return FeeService.instance;
  }

  /**
   * Initialize real-time listener for fee structure changes
   */
  private initializeListener() {
    const feeDocRef = doc(db, 'systemConfig', 'feeStructure');
    
    this.unsubscribe = onSnapshot(feeDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        this.currentFeeStructure = {
          platformFeePercentage: data.platformFeePercentage || 0.0,
          lastUpdated: data.lastUpdated?.toDate() || new Date(),
          updatedBy: data.updatedBy || 'unknown'
        };
      } else {
        // Default structure if document doesn't exist
        this.currentFeeStructure = {
          platformFeePercentage: 0.0,
          lastUpdated: new Date(),
          updatedBy: 'system'
        };
      }

      // Notify all listeners
      this.listeners.forEach(listener => {
        if (this.currentFeeStructure) {
          listener(this.currentFeeStructure);
        }
      });
    }, (error) => {
      console.error('Error listening to fee structure changes:', error);
    });
  }

  /**
   * Get current fee structure (cached or from database)
   */
  public async getCurrentFeeStructure(): Promise<FeeStructure> {
    if (this.currentFeeStructure) {
      return this.currentFeeStructure;
    }

    // If not cached, fetch from database
    try {
      const feeDoc = await getDoc(doc(db, 'systemConfig', 'feeStructure'));
      
      if (feeDoc.exists()) {
        const data = feeDoc.data();
        this.currentFeeStructure = {
          platformFeePercentage: data.platformFeePercentage || 0.0,
          lastUpdated: data.lastUpdated?.toDate() || new Date(),
          updatedBy: data.updatedBy || 'unknown'
        };
      } else {
        // Default structure
        this.currentFeeStructure = {
          platformFeePercentage: 0.0,
          lastUpdated: new Date(),
          updatedBy: 'system'
        };
      }

      return this.currentFeeStructure;
    } catch (error) {
      console.error('Error fetching fee structure:', error);
      // Return default on error
      return {
        platformFeePercentage: 0.0,
        lastUpdated: new Date(),
        updatedBy: 'system'
      };
    }
  }

  /**
   * Update fee structure
   */
  public async updateFeeStructure(
    platformFeePercentage: number, 
    updatedBy: string = 'admin'
  ): Promise<void> {
    const feeStructure: FeeStructure = {
      platformFeePercentage: platformFeePercentage / 100, // Convert percentage to decimal
      lastUpdated: new Date(),
      updatedBy
    };

    await setDoc(doc(db, 'systemConfig', 'feeStructure'), {
      ...feeStructure,
      lastUpdated: new Date() // Firestore timestamp
    });
  }

  /**
   * Subscribe to fee structure changes
   */
  public subscribe(listener: (feeStructure: FeeStructure) => void): () => void {
    this.listeners.push(listener);

    // If we already have a fee structure, call the listener immediately
    if (this.currentFeeStructure) {
      listener(this.currentFeeStructure);
    }

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current fee percentage as a number (0-100)
   */
  public async getCurrentFeePercentage(): Promise<number> {
    const feeStructure = await this.getCurrentFeeStructure();
    return feeStructure.platformFeePercentage * 100;
  }

  /**
   * Cleanup listeners
   */
  public destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.listeners = [];
  }
}

// Export singleton instance
export const feeService = FeeService.getInstance();

// Export convenience functions
export const getCurrentFeeStructure = () => feeService.getCurrentFeeStructure();
export const getCurrentFeePercentage = () => feeService.getCurrentFeePercentage();
export const updateFeeStructure = (percentage: number, updatedBy?: string) => 
  feeService.updateFeeStructure(percentage, updatedBy);
export const subscribeFeeChanges = (listener: (feeStructure: FeeStructure) => void) => 
  feeService.subscribe(listener);
