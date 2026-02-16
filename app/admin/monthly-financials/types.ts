export interface MonthlyFinancialData {
  month: string;
  totalSubscriptionCents: number;
  totalAllocatedCents: number;
  totalUnallocatedCents: number;
  platformFeeCents: number;
  creatorPayoutsCents: number;
  platformRevenueCents: number;
  userCount: number;
  allocationRate: number;
  status: 'in_progress' | 'processed' | 'pending';
}

export interface SubscriberDetail {
  id: string;
  email: string;
  name: string | null;
  subscriptionAmountCents: number;
  allocatedCents: number;           // Total allocated (may exceed subscription)
  fundedAllocatedCents: number;     // Min(allocated, subscription) - backed by money
  overspentUnfundedCents: number;   // Max(0, allocated - subscription) - unfunded portion
  unallocatedCents: number;         // Max(0, subscription - allocated) - leftover
  grossEarningsCents: number;       // Funded earnings before fees
  platformFeeCents: number;         // 10% of funded
  netCreatorPayoutCents: number;    // Funded minus fee
  stripeCustomerId: string;
  status: string;
}

export interface StripeSubscriptionData {
  totalActiveSubscriptions: number;
  totalMRRCents: number;
  subscriptionBreakdown: {
    amount: number;
    count: number;
  }[];
  subscribers: SubscriberDetail[];
}

export interface DiscrepancyDetail {
  type: 'stale_firebase' | 'missing_firebase' | 'amount_mismatch';
  stripeCustomerId: string;
  email: string;
  stripeAmountCents: number;
  firebaseAmountCents: number;
  firebaseDocId?: string;
}

export interface WriterEarningsDetail {
  userId: string;
  email: string;
  name: string | null;
  grossEarningsCents: number;
  platformFeeCents: number;
  netPayoutCents: number;
  pendingEarningsCents: number;
  availableEarningsCents: number;
  bankAccountStatus: 'not_setup' | 'pending' | 'verified' | 'restricted' | 'rejected';
  stripeConnectedAccountId: string | null;
  canReceivePayout: boolean;
}

export interface SyncResults {
  synced: boolean;
  staleRecordsFixed: number;
  missingRecordsCreated: number;
  amountMismatchesFixed: number;
  errors: string[];
}

export interface ReconciliationData {
  stripeSubscriptionsCents: number;
  firebaseRecordedCents: number;
  discrepancyCents: number;
  stripeSubscriberCount: number;
  firebaseUserCount: number;
  userCountDiscrepancy: number;
  isInSync: boolean;
  discrepancies: DiscrepancyDetail[];
  syncResults: SyncResults | null;
}

export interface DataSources {
  subscriptionRevenue: string;
  allocations: string;
  historicalData: string;
}

export interface DebugInfo {
  environment: string;
  stripeMode: string;
  firebaseCollection: string;
  stripeSubscriptionCount: number;
  firebaseRecordCount: number;
}

export interface RealtimeBalanceBreakdown {
  stripeAvailableCents: number;
  stripePendingCents: number;
  totalOwedToWritersCents: number;
  platformRevenueCents: number;
  hasSufficientFunds: boolean;
  lastUpdated: string;
  breakdown: {
    unallocatedFundsCents: number;
    platformFeesCents: number;
    writerPendingCents: number;
    writerAvailableCents: number;
  };
}

export interface FinancialsResponse {
  success: boolean;
  realtimeBalanceBreakdown?: RealtimeBalanceBreakdown;
  currentMonth: {
    data: MonthlyFinancialData;
    daysRemaining: number;
    processingDate: string;
  };
  historicalData: MonthlyFinancialData[];
  stripeBalance: {
    availableCents: number;
    pendingCents: number;
    totalCents: number;
    lastUpdated: string;
  } | null;
  stripeSubscriptions: StripeSubscriptionData;
  writerEarnings?: WriterEarningsDetail[];
  reconciliation: ReconciliationData;
  dataSources: DataSources;
  totals: {
    totalSubscriptionCents: number;
    totalAllocatedCents: number;
    totalUnallocatedCents: number;
    totalPlatformFeeCents: number;
    totalCreatorPayoutsCents: number;
    totalPlatformRevenueCents: number;
    averageAllocationRate: number;
  };
  metadata: {
    platformFeeRate: number;
    fundFlowModel: string;
    description: string;
  };
  debug?: DebugInfo;
}
