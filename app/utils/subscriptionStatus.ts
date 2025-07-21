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
export const getSubscriptionStatusInfo = (
  status: string | null | undefined,
  cancelAtPeriodEnd?: boolean,
  currentPeriodEnd?: string
): SubscriptionStatusInfo => {
  if (!status) {
    return {
      status: 'error',
      displayText: 'Subscription data error',
      variant: 'destructive',
      color: 'text-red-600',
      isActive: false,
      showActivateButton: false,
      showManageButton: false
    };
  }

  switch (status.toLowerCase()) {
    case 'inactive':
      return {
        status: 'inactive',
        displayText: 'No subscription',
        variant: 'secondary',
        color: 'text-gray-600',
        isActive: false,
        showActivateButton: true,
        showManageButton: false
      };

    case 'none':
      // Legacy support for 'none' status
      return {
        status: 'inactive',
        displayText: 'No subscription',
        variant: 'secondary',
        color: 'text-gray-600',
        isActive: false,
        showActivateButton: true,
        showManageButton: false
      };
    case 'active':
      // Check if active subscription is set to cancel at period end
      if (cancelAtPeriodEnd && currentPeriodEnd) {
        const periodEndDate = new Date(currentPeriodEnd);
        const now = new Date();
        const daysUntilEnd = Math.ceil((periodEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilEnd > 0) {
          return {
            status: 'cancelling',
            displayText: `Cancels in ${daysUntilEnd} day${daysUntilEnd === 1 ? '' : 's'}`,
            variant: 'destructive',
            color: 'text-orange-600',
            isActive: true, // Still active until period end
            showActivateButton: false,
            showManageButton: true};
        }
      }

      return {
        status: 'active',
        displayText: 'Active',
        variant: 'default',
        color: 'text-green-600',
        isActive: true,
        showActivateButton: false,
        showManageButton: true};

    case 'pending':
      return {
        status: 'pending',
        displayText: 'Processing',
        variant: 'outline',
        color: 'text-yellow-600',
        isActive: false,
        showActivateButton: false,
        showManageButton: false};

    case 'incomplete':
      return {
        status: 'incomplete',
        displayText: 'Payment Required',
        variant: 'destructive',
        color: 'text-orange-600',
        isActive: false,
        showActivateButton: true,
        showManageButton: false};

    case 'incomplete_expired':
      return {
        status: 'incomplete_expired',
        displayText: 'Payment Expired',
        variant: 'destructive',
        color: 'text-red-600',
        isActive: false,
        showActivateButton: true,
        showManageButton: false};

    case 'past_due':
    case 'unpaid':
      return {
        status: 'past_due',
        displayText: 'Past Due',
        variant: 'destructive',
        color: 'text-red-600',
        isActive: false,
        showActivateButton: false,
        showManageButton: true};

    case 'canceled':
    case 'cancelled':
      // Check if subscription is cancelled but still active until period end
      if (cancelAtPeriodEnd && currentPeriodEnd) {
        const periodEndDate = new Date(currentPeriodEnd);
        const now = new Date();
        const daysUntilEnd = Math.ceil((periodEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilEnd > 0) {
          return {
            status: 'cancelling',
            displayText: `Cancels in ${daysUntilEnd} day${daysUntilEnd === 1 ? '' : 's'}`,
            variant: 'destructive',
            color: 'text-orange-600',
            isActive: true, // Still active until period end
            showActivateButton: false,
            showManageButton: true};
        }
      }

      return {
        status: 'canceled',
        displayText: 'Canceled',
        variant: 'secondary',
        color: 'text-gray-600',
        isActive: false,
        showActivateButton: true,
        showManageButton: false};

    case 'trialing':
      return {
        status: 'trialing',
        displayText: 'Trial',
        variant: 'default',
        color: 'text-blue-600',
        isActive: true,
        showActivateButton: false,
        showManageButton: true};

    case 'paused':
      return {
        status: 'paused',
        displayText: 'Paused',
        variant: 'secondary',
        color: 'text-gray-600',
        isActive: false,
        showActivateButton: false,
        showManageButton: true};

    default:
      return {
        status: status.toLowerCase(),
        displayText: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
        variant: 'secondary',
        color: 'text-gray-600',
        isActive: false,
        showActivateButton: true,
        showManageButton: false};
  }
};

/**
 * Check if subscription status indicates an active subscription
 */
export const isActiveSubscription = (
  status: string | null | undefined,
  cancelAtPeriodEnd?: boolean,
  currentPeriodEnd?: string
): boolean => {
  return getSubscriptionStatusInfo(status, cancelAtPeriodEnd, currentPeriodEnd).isActive;
};

/**
 * Get formatted cancellation date for tooltip display
 */
export const getCancellationTooltip = (
  status: string | null | undefined,
  cancelAtPeriodEnd?: boolean,
  currentPeriodEnd?: string
): string | null => {
  // Show tooltip for both cancelled subscriptions and active subscriptions set to cancel
  if (cancelAtPeriodEnd && currentPeriodEnd &&
      (status === 'canceled' || status === 'cancelled' || status === 'active')) {
    const periodEndDate = new Date(currentPeriodEnd);
    const now = new Date();

    if (periodEndDate > now) {
      return `Subscription will end on ${periodEndDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })} at ${periodEndDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}`;
    }
  }

  return null;
};

/**
 * Get the appropriate button text based on subscription status
 */
export const getSubscriptionButtonText = (
  status: string | null | undefined,
  cancelAtPeriodEnd?: boolean,
  currentPeriodEnd?: string
): string => {
  const statusInfo = getSubscriptionStatusInfo(status, cancelAtPeriodEnd, currentPeriodEnd);

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
export const getSubscriptionNavigationPath = (
  status: string | null | undefined,
  cancelAtPeriodEnd?: boolean,
  currentPeriodEnd?: string
): string => {
  const statusInfo = getSubscriptionStatusInfo(status, cancelAtPeriodEnd, currentPeriodEnd);

  if (statusInfo.showManageButton) {
    return '/settings/spend-tokens';
  }

  return '/settings/subscription';
};

/**
 * Get user-friendly guidance message for subscription status
 */
export const getSubscriptionGuidanceMessage = (status: string | null | undefined): string => {
  if (!status) {
    return 'Start a subscription to support pages and access premium features.';
  }

  switch (status.toLowerCase()) {
    case 'active':
      return 'Your subscription is active and working properly.';

    case 'pending':
      return 'Your subscription is being processed. This usually takes a few moments.';

    case 'incomplete':
      return 'Your subscription requires additional payment information. Please complete the payment process.';

    case 'incomplete_expired':
      return 'Your subscription payment has expired. Please start a new subscription.';

    case 'past_due':
      return 'Your subscription payment failed. Please update your payment method to continue.';

    case 'canceled':
    case 'cancelled':
      return 'Your subscription has been canceled. You can reactivate it at any time.';

    case 'trialing':
      return 'You are currently in your free trial period.';

    case 'paused':
      return 'Your subscription is temporarily paused.';

    default:
      return 'Please check your subscription status or contact support if you need assistance.';
  }
};

/**
 * Get action button text based on subscription status
 */
export const getSubscriptionActionText = (status: string | null | undefined): string => {
  if (!status) {
    return 'Start Subscription';
  }

  switch (status.toLowerCase()) {
    case 'incomplete':
      return 'Complete Payment';

    case 'incomplete_expired':
      return 'Restart Subscription';

    case 'past_due':
      return 'Update Payment Method';

    case 'canceled':
    case 'cancelled':
      return 'Reactivate Subscription';

    case 'pending':
      return 'Check Status';

    default:
      return 'Manage Subscription';
  }
};