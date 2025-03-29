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

// User interface for user profile data
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

// Page interface for page data
export interface Page {
  id: string;
  title: string;
  isPublic: boolean;
  userId: string;
  username?: string;
  authorName?: string;
  lastModified?: string;
  createdAt: string;
  groupId?: string;
  groupName?: string;
  content?: any[];
}