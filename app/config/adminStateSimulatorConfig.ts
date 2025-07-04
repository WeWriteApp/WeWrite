/**
 * Configuration for the Admin State Simulator
 * This file defines all the states that can be simulated and makes it easy to add new ones
 */

import { 
  User, 
  CreditCard, 
  DollarSign, 
  Coins, 
  Bell,
  Settings,
  Shield,
  Zap,
  Globe,
  Clock
} from 'lucide-react';

export interface StateCategory {
  id: string;
  name: string;
  icon: any; // Lucide icon component
  description: string;
  type: 'radio' | 'checkbox' | 'toggle' | 'multi-checkbox';
  options?: StateOption[];
  defaultValue?: any;
}

export interface StateOption {
  id: string;
  label: string;
  description?: string;
  value: any;
}

/**
 * Core state categories for the simulator
 * Add new categories here to extend the simulator
 */
export const STATE_CATEGORIES: StateCategory[] = [
  {
    id: 'authState',
    name: 'Authentication',
    icon: User,
    description: 'Simulate different authentication states',
    type: 'radio',
    defaultValue: 'logged-in',
    options: [
      {
        id: 'logged-out',
        label: 'Logged Out',
        description: 'User is not authenticated',
        value: 'logged-out'
      },
      {
        id: 'logged-in',
        label: 'Logged In',
        description: 'User is authenticated',
        value: 'logged-in'
      }
    ]
  },
  {
    id: 'subscriptionState',
    name: 'Subscription',
    icon: CreditCard,
    description: 'Simulate different subscription states',
    type: 'radio',
    defaultValue: 'active',
    options: [
      {
        id: 'none',
        label: 'No Subscription',
        description: 'User has no active subscription',
        value: 'none'
      },
      {
        id: 'active',
        label: 'Active Subscription',
        description: 'User has an active subscription',
        value: 'active'
      },
      {
        id: 'cancelling',
        label: 'Cancelling Subscription',
        description: 'User is in the process of cancelling',
        value: 'cancelling'
      },
      {
        id: 'payment-failed',
        label: 'Payment Failed',
        description: 'Subscription payment has failed',
        value: 'payment-failed'
      }
    ]
  },
  {
    id: 'spendingState',
    name: 'Spending',
    icon: DollarSign,
    description: 'Simulate spending and allocation states',
    type: 'multi-checkbox',
    defaultValue: { pastMonthTokensSent: false },
    options: [
      {
        id: 'pastMonthTokensSent',
        label: 'Past month tokens allocated and sent',
        description: 'User has allocated tokens in the past month',
        value: true
      }
    ]
  },
  {
    id: 'tokenEarningsState',
    name: 'Token Earnings',
    icon: Coins,
    description: 'Simulate different token earning states',
    type: 'multi-checkbox',
    defaultValue: {
      none: true,
      unfundedLoggedOut: false,
      unfundedNoSubscription: false,
      fundedPending: false,
      lockedAvailable: false
    },
    options: [
      {
        id: 'none',
        label: 'None',
        description: 'No token earnings',
        value: true
      },
      {
        id: 'unfundedLoggedOut',
        label: '10 unfunded: logged out users',
        description: 'Tokens from users who were logged out',
        value: true
      },
      {
        id: 'unfundedNoSubscription',
        label: '10 unfunded: users without subscriptions',
        description: 'Tokens from users without subscriptions',
        value: true
      },
      {
        id: 'fundedPending',
        label: '10 funded: pending (to be locked next month)',
        description: 'Funded tokens pending month-end processing',
        value: true
      },
      {
        id: 'lockedAvailable',
        label: '10 locked: from last month (can be paid out)',
        description: 'Locked tokens available for payout',
        value: true
      }
    ]
  }
];

/**
 * Example of how to add new state categories
 * Uncomment and modify these to add new simulation states
 */

// Example: Notification states
// {
//   id: 'notificationState',
//   name: 'Notifications',
//   icon: Bell,
//   description: 'Simulate notification states',
//   type: 'multi-checkbox',
//   defaultValue: {
//     hasUnread: false,
//     emailVerificationPending: false,
//     paymentReminder: false
//   },
//   options: [
//     {
//       id: 'hasUnread',
//       label: 'Has unread notifications',
//       description: 'User has unread notifications',
//       value: true
//     },
//     {
//       id: 'emailVerificationPending',
//       label: 'Email verification pending',
//       description: 'User needs to verify their email',
//       value: true
//     },
//     {
//       id: 'paymentReminder',
//       label: 'Payment reminder',
//       description: 'User has a payment reminder',
//       value: true
//     }
//   ]
// },

// Example: Feature flag states
// {
//   id: 'featureFlagState',
//   name: 'Feature Flags',
//   icon: Zap,
//   description: 'Simulate feature flag states',
//   type: 'multi-checkbox',
//   defaultValue: {
//     paymentsEnabled: true,
//     betaFeaturesEnabled: false,
//     adminPanelEnabled: false
//   },
//   options: [
//     {
//       id: 'paymentsEnabled',
//       label: 'Payments feature enabled',
//       description: 'Enable payments functionality',
//       value: true
//     },
//     {
//       id: 'betaFeaturesEnabled',
//       label: 'Beta features enabled',
//       description: 'Enable beta features',
//       value: true
//     },
//     {
//       id: 'adminPanelEnabled',
//       label: 'Admin panel enabled',
//       description: 'Enable admin panel access',
//       value: true
//     }
//   ]
// },

// Example: Performance states
// {
//   id: 'performanceState',
//   name: 'Performance',
//   icon: Clock,
//   description: 'Simulate performance conditions',
//   type: 'radio',
//   defaultValue: 'normal',
//   options: [
//     {
//       id: 'normal',
//       label: 'Normal',
//       description: 'Normal performance',
//       value: 'normal'
//     },
//     {
//       id: 'slow',
//       label: 'Slow Network',
//       description: 'Simulate slow network conditions',
//       value: 'slow'
//     },
//     {
//       id: 'offline',
//       label: 'Offline',
//       description: 'Simulate offline state',
//       value: 'offline'
//     }
//   ]
// }

/**
 * Helper function to get default state from configuration
 */
export function getDefaultSimulatorState() {
  const defaultState: any = {};
  
  STATE_CATEGORIES.forEach(category => {
    defaultState[category.id] = category.defaultValue;
  });

  return defaultState;
}

/**
 * Helper function to get state category by ID
 */
export function getStateCategory(id: string): StateCategory | undefined {
  return STATE_CATEGORIES.find(category => category.id === id);
}

/**
 * Helper function to validate state values
 */
export function validateStateValue(categoryId: string, value: any): boolean {
  const category = getStateCategory(categoryId);
  if (!category) return false;

  switch (category.type) {
    case 'radio':
      return category.options?.some(option => option.value === value) || false;
    case 'toggle':
      return typeof value === 'boolean';
    case 'checkbox':
      return typeof value === 'boolean';
    case 'multi-checkbox':
      return typeof value === 'object' && value !== null;
    default:
      return false;
  }
}
