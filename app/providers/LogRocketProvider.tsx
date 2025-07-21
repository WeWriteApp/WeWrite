/**
 * LogRocket Provider for WeWrite
 * 
 * React context provider that manages LogRocket initialization
 * and provides tracking functions throughout the app
 */

'use client';

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { logRocketService, trackEvent, captureMessage, getSessionURL } from '../utils/logrocket';

// Context type definition
interface LogRocketContextType {
  isReady: boolean;
  track: typeof trackEvent;
  captureMessage: typeof captureMessage;
  getSessionURL: typeof getSessionURL;
  // Specific tracking functions for WeWrite features
  trackDragDropLink: (data: DragDropLinkData) => void;
  trackTokenAllocation: (data: TokenAllocationData) => void;
  trackModalInteraction: (data: ModalInteractionData) => void;
  trackPayoutFlow: (data: PayoutFlowData) => void;
  trackPageCreation: (data: PageCreationData) => void;
  trackPageEdit: (data: PageEditData) => void;
}

// Event data types for WeWrite-specific tracking
interface DragDropLinkData {
  action: 'start' | 'move' | 'drop' | 'cancel';
  linkId?: string;
  fromPosition?: number;
  toPosition?: number;
  pageId?: string;
}

interface TokenAllocationData {
  action: 'allocate' | 'deallocate' | 'view_balance' | 'convert';
  amount?: number;
  pageId?: string;
  totalBalance?: number; // Will be sanitized
}

interface ModalInteractionData {
  modalType: string;
  action: 'open' | 'close' | 'submit' | 'cancel';
  source?: string;
}

interface PayoutFlowData {
  step: 'start' | 'bank_setup' | 'amount_entry' | 'confirmation' | 'complete' | 'error';
  payoutAmount?: number; // Will be sanitized
  bankAccountType?: string;
  errorType?: string;
}

interface PageCreationData {
  pageType?: string;
  hasCustomDate?: boolean;
  hasLocation?: boolean;
  templateUsed?: string;
}

interface PageEditData {
  action: 'save' | 'auto_save' | 'undo' | 'redo';
  pageId?: string;
  contentLength?: number;
  linksCount?: number;
}

// Create context
const LogRocketContext = createContext<LogRocketContextType | null>(null);

// Provider component
interface LogRocketProviderProps {
  children: ReactNode;
}

export function LogRocketProvider({ children }: LogRocketProviderProps) {
  // Initialize LogRocket on mount (client-side only)
  useEffect(() => {
    console.log('🔍 LogRocketProvider: Initializing LogRocket...');

    // Initialize LogRocket if we're on the client side
    if (typeof window !== 'undefined') {
      try {
        logRocketService.init();
        console.log('✅ LogRocketProvider: LogRocket initialization attempted');
      } catch (error) {
        console.error('❌ LogRocketProvider: Failed to initialize LogRocket:', error);
      }
    } else {
      console.log('⏭️ LogRocketProvider: Skipping LogRocket init (server-side)');
    }
  }, []);

  // WeWrite-specific tracking functions with data sanitization
  const trackDragDropLink = (data: DragDropLinkData) => {
    trackEvent('drag_drop_link', {
      action: data.action,
      linkId: data.linkId ? `link_${data.linkId.substring(0, 8)}` : undefined, // Truncate for privacy
      fromPosition: data.fromPosition,
      toPosition: data.toPosition,
      pageId: data.pageId ? `page_${data.pageId.substring(0, 8)}` : undefined, // Truncate for privacy
      timestamp: new Date().toISOString(),
    });
  };

  const trackTokenAllocation = (data: TokenAllocationData) => {
    // Sanitize token amounts - only track ranges, not exact amounts
    const sanitizedAmount = data.amount ? getSanitizedAmountRange(data.amount) : undefined;
    const sanitizedBalance = data.totalBalance ? getSanitizedAmountRange(data.totalBalance) : undefined;

    trackEvent('token_allocation', {
      action: data.action,
      amountRange: sanitizedAmount, // e.g., "1-10", "11-50", "51-100", "100+"
      balanceRange: sanitizedBalance,
      pageId: data.pageId ? `page_${data.pageId.substring(0, 8)}` : undefined,
      timestamp: new Date().toISOString(),
    });
  };

  const trackModalInteraction = (data: ModalInteractionData) => {
    trackEvent('modal_interaction', {
      modalType: data.modalType,
      action: data.action,
      source: data.source,
      timestamp: new Date().toISOString(),
    });
  };

  const trackPayoutFlow = (data: PayoutFlowData) => {
    // Sanitize payout amounts
    const sanitizedAmount = data.payoutAmount ? getSanitizedAmountRange(data.payoutAmount) : undefined;

    trackEvent('payout_flow', {
      step: data.step,
      amountRange: sanitizedAmount, // Sanitized amount range instead of exact amount
      bankAccountType: data.bankAccountType,
      errorType: data.errorType,
      timestamp: new Date().toISOString(),
    });
  };

  const trackPageCreation = (data: PageCreationData) => {
    trackEvent('page_creation', {
      pageType: data.pageType,
      hasCustomDate: data.hasCustomDate,
      hasLocation: data.hasLocation,
      templateUsed: data.templateUsed,
      timestamp: new Date().toISOString(),
    });
  };

  const trackPageEdit = (data: PageEditData) => {
    trackEvent('page_edit', {
      action: data.action,
      pageId: data.pageId ? `page_${data.pageId.substring(0, 8)}` : undefined,
      contentLength: data.contentLength ? getSanitizedContentLength(data.contentLength) : undefined,
      linksCount: data.linksCount,
      timestamp: new Date().toISOString(),
    });
  };

  // Helper function to sanitize amounts into ranges
  const getSanitizedAmountRange = (amount: number): string => {
    if (amount <= 0) return '0';
    if (amount <= 10) return '1-10';
    if (amount <= 50) return '11-50';
    if (amount <= 100) return '51-100';
    if (amount <= 500) return '101-500';
    if (amount <= 1000) return '501-1000';
    return '1000+';
  };

  // Helper function to sanitize content length into ranges
  const getSanitizedContentLength = (length: number): string => {
    if (length <= 100) return 'short';
    if (length <= 500) return 'medium';
    if (length <= 2000) return 'long';
    return 'very_long';
  };

  const contextValue: LogRocketContextType = {
    isReady: logRocketService.isReady,
    track: trackEvent,
    captureMessage,
    getSessionURL,
    // WeWrite-specific tracking functions
    trackDragDropLink,
    trackTokenAllocation,
    trackModalInteraction,
    trackPayoutFlow,
    trackPageCreation,
    trackPageEdit,
  };

  return (
    <LogRocketContext.Provider value={contextValue}>
      {children}
    </LogRocketContext.Provider>
  );
}

// Hook to use LogRocket context
export function useLogRocket(): LogRocketContextType {
  const context = useContext(LogRocketContext);
  
  if (!context) {
    // Return no-op functions if LogRocket is not available
    // This prevents errors in development or if LogRocket fails to initialize
    return {
      isReady: false,
      track: () => {},
      captureMessage: () => {},
      getSessionURL: () => {},
      trackDragDropLink: () => {},
      trackTokenAllocation: () => {},
      trackModalInteraction: () => {},
      trackPayoutFlow: () => {},
      trackPageCreation: () => {},
      trackPageEdit: () => {},
    };
  }
  
  return context;
}

// Export types for use in other components
export type {
  DragDropLinkData,
  TokenAllocationData,
  ModalInteractionData,
  PayoutFlowData,
  PageCreationData,
  PageEditData,
};
