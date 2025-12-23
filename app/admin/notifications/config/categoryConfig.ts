import { Shield, DollarSign, UserCheck, UserX, Settings, Bell, Sparkles } from 'lucide-react';
import { CategoryConfig } from '../types';

export const categoryConfig: Record<string, CategoryConfig> = {
  authentication: {
    label: 'Authentication',
    icon: Shield,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  payments: {
    label: 'Payments',
    icon: DollarSign,
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  engagementActive: {
    label: 'Engagement (Active Users)',
    icon: UserCheck,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  engagementInactive: {
    label: 'Re-activation (Inactive Users)',
    icon: UserX,
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  engagement: {
    label: 'Engagement',
    icon: Sparkles,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  system: {
    label: 'System',
    icon: Settings,
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  },
  notifications: {
    label: 'Notifications',
    icon: Bell,
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
};
