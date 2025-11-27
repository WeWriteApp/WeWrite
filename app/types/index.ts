// Subscription interface for user subscription data
export interface Subscription {
  id: string;
  amount: number;
  status: string;
  billingCycleEnd: string;
  pledgedAmount: number;
  stripeCustomerId: string;
  stripePriceId: string;
  stripeSubscriptionId: string | null;
  createdAt: any; // Firebase Timestamp
  updatedAt: any; // Firebase Timestamp
}

// Pledge interface for user pledge data
export interface Pledge {
  id: string;
  pageId: string;
  title: string;
  amount: number;
  createdAt: any; // Firebase Timestamp
  updatedAt: any; // Firebase Timestamp
}

// Re-export User interface from database types
export type { User } from './database';