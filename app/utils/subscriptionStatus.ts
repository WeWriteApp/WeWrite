/**
 * Unified subscription status utilities for consistent display across components
 */

export interface SubscriptionStatusInfo {
  status: string;
  displayText: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  color: string;
  isActive: boolean;
  showActivateButton: boolean;
  showManageButton: boolean;
}

/**
 * Get standardized subscription status information
 */
export const getSubscriptionStatusInfo = (status: string | null | undefined): SubscriptionStatusInfo => {
  if (!status) {
    return {
      status: 'none',
      displayText: 'No Subscription',
      variant: 'secondary',
      color: 'text-gray-600',
      isActive: false,
      showActivateButton: true,
      showManageButton: false,
    };
  }

  switch (status.toLowerCase()) {
    case 'active':
      return {
        status: 'active',
        displayText: 'Active',
        variant: 'default',
        color: 'text-green-600',
        isActive: true,
        showActivateButton: false,
        showManageButton: true,
      };

    case 'pending':
    case 'incomplete':
    case 'incomplete_expired':
      return {
        status: 'pending',
        displayText: 'Pending',
        variant: 'outline',
        color: 'text-yellow-600',
        isActive: false,
        showActivateButton: true,
        showManageButton: false,
      };

    case 'past_due':
    case 'unpaid':
      return {
        status: 'past_due',
        displayText: 'Past Due',
        variant: 'destructive',
        color: 'text-red-600',
        isActive: false,
        showActivateButton: false,
        showManageButton: true,
      };

    case 'canceled':
    case 'cancelled':
      return {
        status: 'canceled',
        displayText: 'Canceled',
        variant: 'secondary',
        color: 'text-gray-600',
        isActive: false,
        showActivateButton: true,
        showManageButton: false,
      };

    case 'trialing':
      return {
        status: 'trialing',
        displayText: 'Trial',
        variant: 'default',
        color: 'text-blue-600',
        isActive: true,
        showActivateButton: false,
        showManageButton: true,
      };

    case 'paused':
      return {
        status: 'paused',
        displayText: 'Paused',
        variant: 'secondary',
        color: 'text-gray-600',
        isActive: false,
        showActivateButton: false,
        showManageButton: true,
      };

    default:
      return {
        status: status.toLowerCase(),
        displayText: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
        variant: 'secondary',
        color: 'text-gray-600',
        isActive: false,
        showActivateButton: true,
        showManageButton: false,
      };
  }
};

/**
 * Check if subscription status indicates an active subscription
 */
export const isActiveSubscription = (status: string | null | undefined): boolean => {
  return getSubscriptionStatusInfo(status).isActive;
};

/**
 * Get the appropriate button text based on subscription status
 */
export const getSubscriptionButtonText = (status: string | null | undefined): string => {
  const statusInfo = getSubscriptionStatusInfo(status);
  
  if (statusInfo.showManageButton) {
    return 'Manage Subscription';
  }
  
  if (statusInfo.showActivateButton) {
    if (status === 'canceled' || status === 'cancelled') {
      return 'Reactivate Subscription';
    }
    return 'Activate Subscription';
  }
  
  return 'View Subscription';
};

/**
 * Get the appropriate navigation path based on subscription status
 */
export const getSubscriptionNavigationPath = (status: string | null | undefined): string => {
  const statusInfo = getSubscriptionStatusInfo(status);
  
  if (statusInfo.showManageButton) {
    return '/settings/subscription/manage';
  }
  
  return '/settings/subscription';
};
