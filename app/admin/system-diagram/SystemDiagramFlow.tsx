"use client";

import React, { useCallback, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../../components/ui/sheet';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  Panel,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Types for node details
interface NodeDetailData {
  title: string;
  description: string;
  details: string[];
  files?: { path: string; description: string }[];
  functions?: { name: string; description: string }[];
  upstream?: string[]; // Node IDs that feed into this
  downstream?: string[]; // Node IDs this feeds into
  monitoring?: { tool: string; description: string }[];
  links?: { label: string; path: string }[];
}

// Node detail data for the sidebar
const NODE_DETAILS: Record<string, NodeDetailData> = {
  'infrastructure-group': {
    title: 'Infrastructure',
    description: 'Cloud hosting and deployment infrastructure',
    details: [
      'Vercel: Next.js hosting with edge functions and automatic deployments',
      'Firebase: Authentication, Firestore database, and Cloud Storage',
      'BigQuery: Analytics data warehouse for large-scale queries',
      'LogRocket: Session replay and error monitoring',
    ],
    files: [
      { path: 'vercel.json', description: 'Vercel deployment configuration' },
      { path: 'next.config.js', description: 'Next.js configuration with rewrites' },
      { path: 'firebase.json', description: 'Firebase project configuration' },
      { path: 'app/lib/firebase-rest.ts', description: 'Firebase REST API wrapper' },
    ],
    functions: [
      { name: 'firebaseRest()', description: 'REST-based Firebase operations' },
    ],
    upstream: [],
    downstream: ['firebase', 'stripe', 'algolia', 'resend'],
    monitoring: [
      { tool: 'Vercel Analytics', description: 'Real-time performance metrics' },
      { tool: 'LogRocket', description: 'Session replay and error tracking' },
      { tool: 'Firebase Console', description: 'Database and auth monitoring' },
    ],
    links: [
      { label: 'Vercel Dashboard', path: 'https://vercel.com' },
      { label: 'Firebase Console', path: 'https://console.firebase.google.com' },
    ],
  },
  'stripe': {
    title: 'Stripe',
    description: 'Payment processing and financial infrastructure',
    details: [
      'Subscription billing with multiple tiers ($5-$50/month)',
      'Stripe Connect for creator payouts',
      'Webhook handling for payment events',
      'Platform fee collection (10%)',
    ],
    files: [
      { path: 'app/api/webhooks/stripe-subscription/route.ts', description: 'Subscription webhook handler' },
      { path: 'app/config/platformFee.ts', description: 'Platform fee configuration' },
      { path: 'app/services/stripePayoutService.ts', description: 'Stripe payout processing' },
      { path: 'app/services/stripeStorageBalanceService.ts', description: 'Stripe balance storage' },
      { path: 'app/services/embeddedCheckoutService.ts', description: 'Embedded checkout flow' },
    ],
    functions: [
      { name: 'createSubscription()', description: 'Create new subscription' },
      { name: 'handleWebhook()', description: 'Process Stripe webhook events' },
      { name: 'calculatePlatformFee()', description: 'Calculate 10% platform fee' },
      { name: 'processCreatorPayout()', description: 'Transfer earnings to creator' },
    ],
    upstream: ['infrastructure-group'],
    downstream: ['webhooks', 'financial-services'],
    monitoring: [
      { tool: 'Stripe Dashboard', description: 'Payment and subscription analytics' },
      { tool: 'Webhook Logs', description: 'Event delivery monitoring' },
      { tool: '/admin/financial-tests', description: 'Platform fee verification tests' },
    ],
    links: [
      { label: 'Stripe Dashboard', path: 'https://dashboard.stripe.com' },
      { label: 'Financial Tests', path: '/admin/financial-tests' },
    ],
  },
  'firebase': {
    title: 'Firebase',
    description: 'Backend-as-a-Service for auth, database, and storage',
    details: [
      'Firebase Auth: Email/password authentication with email verification',
      'Firestore: NoSQL document database with real-time sync',
      'Cloud Storage: User uploads and background images',
      '25+ Firestore collections',
    ],
    files: [
      { path: 'app/lib/firebase-rest.ts', description: 'Firebase REST API wrapper' },
      { path: 'app/providers/AuthProvider.tsx', description: 'Auth state management' },
      { path: 'firestore.rules', description: 'Security rules for Firestore' },
      { path: 'storage.rules', description: 'Security rules for Cloud Storage' },
    ],
    functions: [
      { name: 'signInWithEmail()', description: 'Email/password authentication' },
      { name: 'sendVerificationEmail()', description: 'Email verification flow' },
      { name: 'getFirestore()', description: 'Get Firestore instance' },
      { name: 'uploadFile()', description: 'Upload to Cloud Storage' },
    ],
    upstream: ['infrastructure-group'],
    downstream: ['content-services', 'user-services', 'analytics-services'],
    monitoring: [
      { tool: 'Firebase Console', description: 'Real-time database monitoring' },
      { tool: 'Firebase Auth Dashboard', description: 'User authentication metrics' },
      { tool: 'Usage & Billing', description: 'Resource usage tracking' },
    ],
    links: [
      { label: 'Firebase Console', path: 'https://console.firebase.google.com' },
    ],
  },
  'algolia': {
    title: 'Algolia',
    description: 'Primary full-text search engine',
    details: [
      'Instant search results with typo tolerance',
      'Faceted filtering by author, date, visibility',
      'Real-time index updates on page changes',
      'Primary search engine in fallback chain (Algolia → Typesense → Firestore)',
    ],
    files: [
      { path: 'app/lib/algolia.ts', description: 'Algolia client initialization' },
      { path: 'app/lib/algoliaSync.ts', description: 'Algolia index sync utilities' },
      { path: 'app/components/search/FilteredSearchResults.tsx', description: 'Search results UI' },
    ],
    functions: [
      { name: 'searchPages()', description: 'Full-text page search' },
      { name: 'indexPage()', description: 'Add/update page in index' },
      { name: 'deletePage()', description: 'Remove page from index' },
    ],
    upstream: ['infrastructure-group'],
    downstream: ['content-services', 'typesense'],
    monitoring: [
      { tool: 'Algolia Dashboard', description: 'Search analytics and performance' },
      { tool: 'Index Monitoring', description: 'Index size and record count' },
    ],
    links: [
      { label: 'Algolia Dashboard', path: 'https://www.algolia.com/dashboard' },
    ],
  },
  'typesense': {
    title: 'Typesense',
    description: 'Secondary full-text search engine',
    details: [
      'Open-source search engine with typo tolerance',
      'Secondary search in fallback chain (Algolia → Typesense → Firestore)',
      'Environment-aware collections (DEV_ prefix in development)',
      'Fast search (<50ms typical)',
    ],
    files: [
      { path: 'app/lib/typesense.ts', description: 'Typesense client configuration' },
      { path: 'app/lib/typesenseSync.ts', description: 'Typesense sync service' },
      { path: 'app/api/typesense/sync/route.ts', description: 'Batch sync API' },
      { path: 'app/api/typesense/sync-page/route.ts', description: 'Single page sync API' },
    ],
    functions: [
      { name: 'searchPages()', description: 'Full-text page search' },
      { name: 'searchUsers()', description: 'User search' },
      { name: 'syncPageToTypesense()', description: 'Sync page to Typesense' },
      { name: 'ensureCollectionsExist()', description: 'Create collections if missing' },
    ],
    upstream: ['infrastructure-group', 'algolia'],
    downstream: ['content-services'],
    monitoring: [
      { tool: 'Typesense Dashboard', description: 'Cluster health and performance' },
      { tool: 'Collection Stats', description: 'Document count and index size' },
    ],
    links: [
      { label: 'Typesense Cloud', path: 'https://cloud.typesense.org' },
    ],
  },
  'resend': {
    title: 'Resend',
    description: 'Transactional email service',
    details: [
      'Email verification flows',
      'Password reset emails',
      'Notification emails',
      'Custom email templates',
    ],
    files: [
      { path: 'app/services/emailService.ts', description: 'Email sending service' },
      { path: 'app/lib/emailTemplates.ts', description: 'HTML email templates' },
      { path: 'app/services/resendContactsService.ts', description: 'Resend contacts management' },
      { path: 'app/services/emailVerificationNotifications.ts', description: 'Verification email service' },
    ],
    functions: [
      { name: 'sendVerificationEmail()', description: 'Send email verification' },
      { name: 'sendPasswordReset()', description: 'Password reset flow' },
      { name: 'sendNotification()', description: 'User notification emails' },
    ],
    upstream: ['infrastructure-group'],
    downstream: ['user-services'],
    monitoring: [
      { tool: 'Resend Dashboard', description: 'Email delivery rates and bounces' },
      { tool: 'Logs', description: 'Email send history' },
    ],
    links: [
      { label: 'Resend Dashboard', path: 'https://resend.com/dashboard' },
    ],
  },
  'financial-services': {
    title: 'Financial Services',
    description: 'Business logic for payments and earnings',
    details: [
      'earningsCalculationEngine.ts: Calculate creator earnings',
      'platformFeeAnalytics.ts: Track platform revenue',
      'platformRevenueService.ts: Revenue reporting',
      'useItOrLoseItService.ts: Monthly allocation processing',
    ],
    files: [
      { path: 'app/services/earningsCalculationEngine.ts', description: 'Creator earnings calculation' },
      { path: 'app/services/platformFeeAnalytics.ts', description: 'Platform fee tracking' },
      { path: 'app/services/platformRevenueService.ts', description: 'Revenue aggregation' },
      { path: 'app/services/useItOrLoseItService.ts', description: 'Monthly balance processing' },
      { path: 'app/services/usdService.ts', description: 'USD allocation management' },
      { path: 'app/services/payoutServiceUnified.ts', description: 'Unified payout processing' },
      { path: 'app/services/financialValidationService.ts', description: 'Financial validation' },
    ],
    functions: [
      { name: 'calculateCreatorEarnings()', description: 'Compute earnings from allocations' },
      { name: 'processMonthlyAllocations()', description: 'End-of-month processing' },
      { name: 'getPlatformRevenue()', description: 'Aggregate platform revenue' },
      { name: 'validatePayout()', description: 'Verify payout eligibility' },
    ],
    upstream: ['stripe', 'webhooks'],
    downstream: ['api-routes'],
    monitoring: [
      { tool: '/admin/monthly-financials', description: 'Monthly financial reports' },
      { tool: '/admin/payout-validation', description: 'Payout verification dashboard' },
      { tool: '/admin/financial-tests', description: 'Automated financial tests' },
    ],
    links: [
      { label: 'Monthly Financials', path: '/admin/monthly-financials' },
      { label: 'Payout Validation', path: '/admin/payout-validation' },
      { label: 'Financial Tests', path: '/admin/financial-tests' },
    ],
  },
  'content-services': {
    title: 'Content Services',
    description: 'Page and content management',
    details: [
      'Page CRUD operations with version history',
      'Link suggestion and auto-linking',
      'Content indexing for search',
      'Graph relationship tracking',
    ],
    files: [
      { path: 'app/api/pages/[id]/route.ts', description: 'Page CRUD API endpoint' },
      { path: 'app/services/versionService.ts', description: 'Version history management' },
      { path: 'app/services/linkSuggestionService.ts', description: 'Link suggestion engine' },
      { path: 'app/services/pageLinkService.ts', description: 'Page link management' },
      { path: 'app/services/linkMentionService.ts', description: 'Link mention tracking' },
    ],
    functions: [
      { name: 'createPage()', description: 'Create new page' },
      { name: 'updatePage()', description: 'Update page with versioning' },
      { name: 'getVersionHistory()', description: 'Fetch page versions' },
      { name: 'suggestLinks()', description: 'Generate link suggestions' },
    ],
    upstream: ['firebase', 'algolia'],
    downstream: ['api-routes'],
    monitoring: [
      { tool: '/admin', description: 'Page count and activity metrics' },
      { tool: 'NewPagesWidget', description: 'New page creation tracking' },
      { tool: 'EditsAnalyticsWidget', description: 'Edit activity monitoring' },
    ],
    links: [
      { label: 'Admin Dashboard', path: '/admin' },
    ],
  },
  'user-services': {
    title: 'User Services',
    description: 'User management and social features',
    details: [
      'User profile management',
      'Follow/unfollow relationships',
      'Username history tracking',
      'Email preferences',
    ],
    files: [
      { path: 'app/api/users/[userId]/profile-data/route.ts', description: 'User profile API' },
      { path: 'app/api/follows/users/route.ts', description: 'Follow relationships API' },
      { path: 'app/services/usernameNotificationService.ts', description: 'Username change notifications' },
      { path: 'app/services/emailSettingsTokenService.ts', description: 'Email settings tokens' },
      { path: 'app/providers/AuthProvider.tsx', description: 'Auth state management' },
    ],
    functions: [
      { name: 'updateProfile()', description: 'Update user profile' },
      { name: 'followUser()', description: 'Create follow relationship' },
      { name: 'changeUsername()', description: 'Update username with history' },
      { name: 'updateEmailPreferences()', description: 'Manage email settings' },
    ],
    upstream: ['firebase', 'resend'],
    downstream: ['api-routes'],
    monitoring: [
      { tool: '/admin/users', description: 'User management dashboard' },
      { tool: 'NewAccountsWidget', description: 'Registration tracking' },
      { tool: 'UserManagement', description: 'User activity monitoring' },
    ],
    links: [
      { label: 'User Management', path: '/admin/users' },
    ],
  },
  'analytics-services': {
    title: 'Analytics Services',
    description: 'Tracking and metrics collection',
    details: [
      'Page view tracking',
      'User activity logging',
      'Platform-wide analytics',
      'BigQuery data export',
    ],
    files: [
      { path: 'app/utils/analytics-service.ts', description: 'Analytics tracking service' },
      { path: 'app/utils/analyticsCache.ts', description: 'Analytics caching layer' },
      { path: 'app/utils/analyticsDataProcessing.ts', description: 'Data processing utilities' },
      { path: 'app/hooks/useDashboardAnalytics.ts', description: 'Analytics data hooks' },
      { path: 'app/services/VisitorTrackingService.ts', description: 'Visitor tracking' },
      { path: 'app/services/UnifiedStatsService.ts', description: 'Unified statistics' },
    ],
    functions: [
      { name: 'trackPageView()', description: 'Record page view event' },
      { name: 'trackEvent()', description: 'Log custom analytics event' },
      { name: 'getAnalytics()', description: 'Fetch aggregated metrics' },
      { name: 'exportToBigQuery()', description: 'Export to data warehouse' },
    ],
    upstream: ['firebase'],
    downstream: ['admin-api'],
    monitoring: [
      { tool: '/admin', description: 'Real-time analytics dashboard' },
      { tool: 'VisitorAnalyticsWidget', description: 'Visitor metrics' },
      { tool: 'PageViewsAnalyticsWidget', description: 'Page view tracking' },
      { tool: 'BigQuery Console', description: 'Advanced analytics queries' },
    ],
    links: [
      { label: 'Admin Dashboard', path: '/admin' },
    ],
  },
  'api-routes': {
    title: 'API Routes',
    description: 'Next.js API endpoints',
    details: [
      '75+ API endpoints in /app/api',
      'RESTful design patterns',
      'Authentication middleware',
      'Rate limiting and validation',
    ],
    files: [
      { path: 'app/api/pages/[id]/route.ts', description: 'Page CRUD endpoint' },
      { path: 'app/api/users/[userId]/route.ts', description: 'User endpoints' },
      { path: 'app/api/follows/route.ts', description: 'Follow/unfollow API' },
      { path: 'app/api/stats/[type]/route.ts', description: 'Statistics endpoints' },
      { path: 'app/api/admin-auth-helper.ts', description: 'Admin authentication helper' },
    ],
    functions: [
      { name: 'GET/POST/PUT/DELETE', description: 'HTTP method handlers' },
      { name: 'validateAuth()', description: 'Authenticate requests' },
      { name: 'validateInput()', description: 'Request validation' },
    ],
    upstream: ['financial-services', 'content-services', 'user-services'],
    downstream: ['components', 'contexts', 'hooks', 'editor'],
    monitoring: [
      { tool: 'Vercel Functions', description: 'API performance metrics' },
      { tool: 'LogRocket', description: 'Error tracking' },
    ],
    links: [
      { label: 'Vercel Functions', path: 'https://vercel.com' },
    ],
  },
  'webhooks': {
    title: 'Webhooks',
    description: 'External service event handlers',
    details: [
      'Stripe subscription webhooks',
      'Stripe payout webhooks',
      'Secure signature verification',
    ],
    files: [
      { path: 'app/api/webhooks/stripe-subscription/route.ts', description: 'Subscription events' },
      { path: 'app/api/webhooks/stripe-payouts/route.ts', description: 'Payout events' },
    ],
    functions: [
      { name: 'verifyWebhookSignature()', description: 'Validate Stripe signature' },
      { name: 'handleSubscriptionEvent()', description: 'Process subscription changes' },
      { name: 'handlePayoutEvent()', description: 'Process payout events' },
    ],
    upstream: ['stripe'],
    downstream: ['financial-services'],
    monitoring: [
      { tool: 'Stripe Webhook Logs', description: 'Delivery status and retries' },
      { tool: 'Vercel Logs', description: 'Webhook execution logs' },
    ],
    links: [
      { label: 'Stripe Webhooks', path: 'https://dashboard.stripe.com/webhooks' },
    ],
  },
  'admin-api': {
    title: 'Admin APIs',
    description: 'Administrative endpoints',
    details: [
      '80+ admin-only endpoints',
      'User management APIs',
      'Financial reporting APIs',
      'Platform configuration APIs',
    ],
    files: [
      { path: 'app/api/admin/users/route.ts', description: 'User management API' },
      { path: 'app/api/admin/monthly-financials/route.ts', description: 'Financial reports API' },
      { path: 'app/api/admin/platform-revenue/route.ts', description: 'Revenue API' },
      { path: 'app/api/admin-auth-helper.ts', description: 'Admin auth verification' },
    ],
    functions: [
      { name: 'verifyAdminAccess()', description: 'Check admin permissions' },
      { name: 'getMonthlyFinancials()', description: 'Generate financial reports' },
      { name: 'getUserActivity()', description: 'Fetch user activity logs' },
    ],
    upstream: ['analytics-services'],
    downstream: ['components'],
    monitoring: [
      { tool: '/admin', description: 'Admin dashboard' },
      { tool: 'SecurityMonitoringDashboard', description: 'Security event tracking' },
    ],
    links: [
      { label: 'Admin Dashboard', path: '/admin' },
    ],
  },
  'components': {
    title: 'React Components',
    description: 'UI component library',
    details: [
      '350+ React components',
      'Organized by feature domain',
      'Shared UI primitives in /ui',
      'Feature-specific components',
    ],
    files: [
      { path: 'app/components/ui/', description: 'Shared UI primitives' },
      { path: 'app/components/editor/', description: 'Editor components' },
      { path: 'app/components/pages/', description: 'Page display components' },
      { path: 'app/components/payments/', description: 'Payment UI components' },
      { path: 'app/components/admin/', description: 'Admin dashboard widgets' },
    ],
    functions: [
      { name: '<Button />', description: 'Reusable button component' },
      { name: '<Icon />', description: 'Icon system with 200+ icons' },
      { name: '<Modal />', description: 'Modal dialog system' },
      { name: '<Drawer />', description: 'Slide-out drawer' },
    ],
    upstream: ['api-routes', 'admin-api'],
    downstream: ['clients-group'],
    monitoring: [
      { tool: '/admin/design-system', description: 'Component showcase' },
      { tool: 'LogRocket', description: 'Component error tracking' },
    ],
    links: [
      { label: 'Design System', path: '/admin/design-system' },
    ],
  },
  'contexts': {
    title: 'Contexts & Providers',
    description: 'React state management',
    details: [
      '20 context providers',
      'AuthProvider: User authentication state',
      'SubscriptionContext: Subscription status',
      'UsdBalanceContext: User balance tracking',
    ],
    files: [
      { path: 'app/providers/AuthProvider.tsx', description: 'Authentication state' },
      { path: 'app/contexts/SubscriptionContext.tsx', description: 'Subscription management' },
      { path: 'app/contexts/UsdBalanceContext.tsx', description: 'Balance tracking' },
      { path: 'app/providers/ConsolidatedProviders.tsx', description: 'Provider composition' },
    ],
    functions: [
      { name: 'useAuth()', description: 'Access auth state' },
      { name: 'useSubscription()', description: 'Access subscription state' },
      { name: 'useUsdBalance()', description: 'Access balance state' },
    ],
    upstream: ['api-routes'],
    downstream: ['clients-group'],
    monitoring: [
      { tool: 'React DevTools', description: 'Context state inspection' },
      { tool: 'LogRocket', description: 'State change tracking' },
    ],
  },
  'hooks': {
    title: 'Custom Hooks',
    description: 'Reusable React hooks',
    details: [
      '46+ custom hooks',
      'Data fetching hooks',
      'UI state hooks',
      'Feature-specific hooks',
    ],
    files: [
      { path: 'app/hooks/useUserPages.ts', description: 'User pages fetching with pagination' },
      { path: 'app/hooks/useAllocationState.ts', description: 'Allocation management' },
      { path: 'app/hooks/useAllocationActions.ts', description: 'Allocation mutations' },
      { path: 'app/hooks/useDashboardAnalytics.ts', description: 'Admin analytics' },
      { path: 'app/hooks/useNavigationPreloader.ts', description: 'Route preloading' },
      { path: 'app/hooks/useDebounce.ts', description: 'Debounced value updates' },
    ],
    functions: [
      { name: 'useUserPages()', description: 'Fetch user pages with sorting and pagination' },
      { name: 'useAllocationState()', description: 'Manage user allocations' },
      { name: 'useDebounce()', description: 'Debounced value updates' },
    ],
    upstream: ['api-routes'],
    downstream: ['clients-group'],
    monitoring: [
      { tool: 'React DevTools', description: 'Hook state inspection' },
    ],
  },
  'editor': {
    title: 'Slate Editor',
    description: 'Rich text editing engine',
    details: [
      'Slate.js-based editor',
      'Custom plugins for links',
      'Auto-save with debouncing',
      'Link suggestion system',
    ],
    files: [
      { path: 'app/components/editor/Editor.tsx', description: 'Main editor component' },
      { path: 'app/components/editor/TextView.tsx', description: 'Text rendering view' },
      { path: 'app/components/editor/LinkEditorModal.tsx', description: 'Link editing UI' },
      { path: 'app/components/editor/LinkSuggestionEditorModal.tsx', description: 'Link suggestions' },
    ],
    functions: [
      { name: 'withLinks()', description: 'Link plugin for Slate' },
      { name: 'serialize()', description: 'Convert to storage format' },
      { name: 'deserialize()', description: 'Parse from storage format' },
    ],
    upstream: ['api-routes'],
    downstream: ['clients-group'],
    monitoring: [
      { tool: 'LogRocket', description: 'Editor interaction tracking' },
      { tool: 'EditsAnalyticsWidget', description: 'Edit activity metrics' },
    ],
  },
  'clients-group': {
    title: 'Client Applications',
    description: 'End-user interfaces',
    details: [
      'Web: Next.js 14 with App Router',
      'PWA: Service worker for offline support',
      'iOS: Capacitor-wrapped native app',
      'Android: Capacitor-wrapped native app',
    ],
    files: [
      { path: 'app/layout.tsx', description: 'Root layout component' },
      { path: 'public/sw.js', description: 'Service worker for PWA' },
      { path: 'capacitor.config.ts', description: 'Capacitor configuration' },
      { path: 'ios/', description: 'iOS native project' },
      { path: 'android/', description: 'Android native project' },
    ],
    functions: [
      { name: 'registerServiceWorker()', description: 'PWA installation' },
      { name: 'Capacitor.Plugins', description: 'Native platform APIs' },
    ],
    upstream: ['components', 'contexts', 'hooks', 'editor'],
    downstream: [],
    monitoring: [
      { tool: 'PWAStatusWidget', description: 'PWA installation tracking' },
      { tool: 'PWAInstallsAnalyticsWidget', description: 'Install metrics' },
      { tool: 'App Store Connect', description: 'iOS app analytics' },
      { tool: 'Google Play Console', description: 'Android app analytics' },
    ],
    links: [
      { label: 'PWA Status', path: '/admin' },
    ],
  },
};

// Custom node component for system components
function SystemNode({ data, id }: NodeProps) {
  const nodeData = data as {
    label: string;
    icon?: string;
    description?: string;
    color?: string;
    items?: Array<{ name: string; description: string }>;
    isGroup?: boolean;
    onNodeClick?: (nodeId: string) => void;
  };

  const handleClick = () => {
    if (nodeData.onNodeClick) {
      nodeData.onNodeClick(id);
    }
  };

  if (nodeData.isGroup) {
    return (
      <div
        onClick={handleClick}
        className="rounded-xl border-2 p-4 min-w-[200px] cursor-pointer hover:shadow-lg transition-shadow"
        style={{
          backgroundColor: nodeData.color ? `${nodeData.color}15` : 'var(--muted)',
          borderColor: nodeData.color || 'var(--border)'
        }}
      >
        {/* Hidden handles for edge connections - invisible since we disabled edge creation */}
        <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0" />
        <div className="flex items-center gap-2 mb-2">
          {nodeData.icon && <Icon name={nodeData.icon} size={18} style={{ color: nodeData.color }} />}
          <span className="font-semibold text-sm" style={{ color: nodeData.color }}>{nodeData.label}</span>
        </div>
        {nodeData.items && (
          <div className="space-y-1">
            {nodeData.items.map((item, i) => (
              <div key={i} className="text-xs text-muted-foreground bg-background/50 rounded px-2 py-1">
                {item.name}
              </div>
            ))}
          </div>
        )}
        <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" />
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="rounded-lg border bg-card p-3 min-w-[140px] shadow-sm cursor-pointer hover:shadow-lg transition-shadow"
      style={{ borderColor: nodeData.color || 'var(--border)' }}
    >
      {/* Hidden handles for edge connections - invisible since we disabled edge creation */}
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0" />
      <div className="flex items-center gap-2">
        {nodeData.icon && <Icon name={nodeData.icon} size={16} style={{ color: nodeData.color }} />}
        <span className="font-medium text-sm">{nodeData.label}</span>
      </div>
      {nodeData.description && (
        <p className="text-xs text-muted-foreground mt-1">{nodeData.description}</p>
      )}
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0" />
    </div>
  );
}

// Node types registration
const nodeTypes = {
  systemNode: SystemNode,
};

// Colors for different layers (reordered: infrastructure at top, clients at bottom)
const LAYER_COLORS = {
  infrastructure: '#ef4444', // red
  external: '#f97316',       // orange
  services: '#eab308',       // yellow
  api: '#22c55e',            // green
  frontend: '#a855f7',       // purple
  clients: '#3b82f6',        // blue
};

// Create initial nodes with click handler injected
const createInitialNodes = (onNodeClick: (nodeId: string) => void): Node[] => [
  // === INFRASTRUCTURE LAYER (Top) - Data sources ===
  {
    id: 'infrastructure-group',
    type: 'systemNode',
    position: { x: 300, y: 0 },
    data: {
      label: 'Infrastructure',
      icon: 'Server',
      color: LAYER_COLORS.infrastructure,
      isGroup: true,
      items: [
        { name: 'Vercel', description: 'Hosting' },
        { name: 'BigQuery', description: 'Analytics' },
        { name: 'LogRocket', description: 'Monitoring' },
      ],
      onNodeClick,
    },
  },

  // === EXTERNAL SERVICES ===
  {
    id: 'stripe',
    type: 'systemNode',
    position: { x: 0, y: 180 },
    data: {
      label: 'Stripe',
      icon: 'CreditCard',
      description: 'Payments & payouts',
      color: LAYER_COLORS.external,
      onNodeClick,
    },
  },
  {
    id: 'firebase',
    type: 'systemNode',
    position: { x: 200, y: 180 },
    data: {
      label: 'Firebase',
      icon: 'Database',
      description: 'Auth, Firestore, Storage',
      color: LAYER_COLORS.external,
      onNodeClick,
    },
  },
  {
    id: 'algolia',
    type: 'systemNode',
    position: { x: 350, y: 180 },
    data: {
      label: 'Algolia',
      icon: 'Search',
      description: 'Primary search',
      color: LAYER_COLORS.external,
      onNodeClick,
    },
  },
  {
    id: 'typesense',
    type: 'systemNode',
    position: { x: 500, y: 180 },
    data: {
      label: 'Typesense',
      icon: 'Search',
      description: 'Secondary search',
      color: LAYER_COLORS.external,
      onNodeClick,
    },
  },
  {
    id: 'resend',
    type: 'systemNode',
    position: { x: 650, y: 180 },
    data: {
      label: 'Resend',
      icon: 'Mail',
      description: 'Transactional emails',
      color: LAYER_COLORS.external,
      onNodeClick,
    },
  },

  // === SERVICES LAYER ===
  {
    id: 'financial-services',
    type: 'systemNode',
    position: { x: 50, y: 340 },
    data: {
      label: 'Financial Services',
      icon: 'DollarSign',
      description: 'Earnings, payouts, fees',
      color: LAYER_COLORS.services,
      onNodeClick,
    },
  },
  {
    id: 'content-services',
    type: 'systemNode',
    position: { x: 250, y: 340 },
    data: {
      label: 'Content Services',
      icon: 'FileText',
      description: 'Pages, versions, links',
      color: LAYER_COLORS.services,
      onNodeClick,
    },
  },
  {
    id: 'user-services',
    type: 'systemNode',
    position: { x: 450, y: 340 },
    data: {
      label: 'User Services',
      icon: 'Users',
      description: 'Auth, profiles, follows',
      color: LAYER_COLORS.services,
      onNodeClick,
    },
  },
  {
    id: 'analytics-services',
    type: 'systemNode',
    position: { x: 650, y: 340 },
    data: {
      label: 'Analytics Services',
      icon: 'BarChart3',
      description: 'Tracking, metrics',
      color: LAYER_COLORS.services,
      onNodeClick,
    },
  },

  // === API LAYER ===
  {
    id: 'api-routes',
    type: 'systemNode',
    position: { x: 200, y: 500 },
    data: {
      label: 'API Routes',
      icon: 'Server',
      description: '75+ endpoints',
      color: LAYER_COLORS.api,
      onNodeClick,
    },
  },
  {
    id: 'webhooks',
    type: 'systemNode',
    position: { x: 400, y: 500 },
    data: {
      label: 'Webhooks',
      icon: 'Webhook',
      description: 'Stripe events',
      color: LAYER_COLORS.api,
      onNodeClick,
    },
  },
  {
    id: 'admin-api',
    type: 'systemNode',
    position: { x: 600, y: 500 },
    data: {
      label: 'Admin APIs',
      icon: 'Shield',
      description: '80+ admin endpoints',
      color: LAYER_COLORS.api,
      onNodeClick,
    },
  },

  // === FRONTEND LAYER ===
  {
    id: 'components',
    type: 'systemNode',
    position: { x: 100, y: 660 },
    data: {
      label: 'React Components',
      icon: 'Layers',
      description: '350+ components',
      color: LAYER_COLORS.frontend,
      onNodeClick,
    },
  },
  {
    id: 'contexts',
    type: 'systemNode',
    position: { x: 300, y: 660 },
    data: {
      label: 'Contexts & Providers',
      icon: 'GitBranch',
      description: '20 state providers',
      color: LAYER_COLORS.frontend,
      onNodeClick,
    },
  },
  {
    id: 'hooks',
    type: 'systemNode',
    position: { x: 500, y: 660 },
    data: {
      label: 'Custom Hooks',
      icon: 'Anchor',
      description: '48+ hooks',
      color: LAYER_COLORS.frontend,
      onNodeClick,
    },
  },
  {
    id: 'editor',
    type: 'systemNode',
    position: { x: 700, y: 660 },
    data: {
      label: 'Slate Editor',
      icon: 'Edit3',
      description: 'Rich text editing',
      color: LAYER_COLORS.frontend,
      onNodeClick,
    },
  },

  // === CLIENTS LAYER (Bottom) - Users ===
  {
    id: 'clients-group',
    type: 'systemNode',
    position: { x: 300, y: 840 },
    data: {
      label: 'Users',
      icon: 'Users',
      color: LAYER_COLORS.clients,
      isGroup: true,
      items: [
        { name: 'Web & PWA', description: 'Next.js' },
        { name: 'iOS & Android', description: 'Capacitor' },
      ],
      onNodeClick,
    },
  },
];

// Edge label style for dark theme compatibility (black bg, neutral alpha 30 text)
const edgeLabelStyle = {
  fill: 'rgba(255, 255, 255, 0.7)', // neutral alpha 30 equivalent for dark bg
  fontWeight: 500,
  fontSize: 10,
};

const edgeLabelBgStyle = {
  fill: '#000000', // black background
  fillOpacity: 0.8,
};

// Initial edges - data flows DOWN from infrastructure to users
const initialEdges: Edge[] = [
  // Infrastructure to External Services
  { id: 'e-infra-firebase', source: 'infrastructure-group', target: 'firebase', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.infrastructure }, label: 'hosts', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },

  // External to Services (data flows down)
  { id: 'e-stripe-financial', source: 'stripe', target: 'financial-services', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.external }, label: 'payments', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-firebase-content', source: 'firebase', target: 'content-services', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.external }, label: 'Firestore', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-firebase-user', source: 'firebase', target: 'user-services', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.external }, label: 'auth', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-algolia-typesense', source: 'algolia', target: 'typesense', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.external, strokeDasharray: '5,5' }, label: 'fallback', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-algolia-content', source: 'algolia', target: 'content-services', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.external }, label: 'search', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-typesense-content', source: 'typesense', target: 'content-services', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.external }, label: 'search', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-resend-user', source: 'resend', target: 'user-services', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.external }, label: 'emails', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },

  // Stripe webhooks connection
  { id: 'e-stripe-webhooks', source: 'stripe', target: 'webhooks', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.external }, label: 'webhooks', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },

  // Services to API
  { id: 'e-financial-api', source: 'financial-services', target: 'api-routes', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.services }, label: 'earnings', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-content-api', source: 'content-services', target: 'api-routes', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.services }, label: 'pages', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-user-api', source: 'user-services', target: 'api-routes', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.services }, label: 'profiles', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-analytics-admin', source: 'analytics-services', target: 'admin-api', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.services }, label: 'metrics', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-webhooks-financial', source: 'webhooks', target: 'financial-services', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.api, strokeDasharray: '5,5' }, label: 'events', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },

  // API to Frontend
  { id: 'e-api-components', source: 'api-routes', target: 'components', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.api }, label: 'data', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-api-contexts', source: 'api-routes', target: 'contexts', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.api }, label: 'state', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-api-hooks', source: 'api-routes', target: 'hooks', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.api }, label: 'fetch', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-api-editor', source: 'api-routes', target: 'editor', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.api }, label: 'content', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-admin-components', source: 'admin-api', target: 'components', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: LAYER_COLORS.api, strokeDasharray: '5,5' }, label: 'admin', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },

  // Frontend to Clients
  { id: 'e-components-clients', source: 'components', target: 'clients-group', animated: true, style: { stroke: LAYER_COLORS.frontend }, label: 'UI', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-contexts-clients', source: 'contexts', target: 'clients-group', animated: true, style: { stroke: LAYER_COLORS.frontend }, label: 'providers', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-hooks-clients', source: 'hooks', target: 'clients-group', animated: true, style: { stroke: LAYER_COLORS.frontend }, label: 'logic', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
  { id: 'e-editor-clients', source: 'editor', target: 'clients-group', animated: true, style: { stroke: LAYER_COLORS.frontend }, label: 'editing', labelStyle: edgeLabelStyle, labelBgStyle: edgeLabelBgStyle },
];

// Inner flow component
function Flow() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(nodeId);
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(createInitialNodes(handleNodeClick));
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onResetLayout = useCallback(() => {
    setNodes(createInitialNodes(handleNodeClick));
    setEdges(initialEdges);
  }, [setNodes, setEdges, handleNodeClick]);

  const selectedNodeDetails = selectedNode ? NODE_DETAILS[selectedNode] : null;

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
        // Disable edge creation
        edgesReconnectable={false}
        nodesConnectable={false}
        nodesDraggable={true}
        elementsSelectable={true}
        onPaneClick={() => setSelectedNode(null)}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls position="bottom-left" />

        {/* Legend Panel */}
        <Panel position="top-right" className="bg-card border rounded-lg p-3 shadow-lg">
          <h4 className="font-semibold text-sm mb-2">Data Flow Layers</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: LAYER_COLORS.infrastructure }} />
              <span>Infrastructure</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: LAYER_COLORS.external }} />
              <span>External Services</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: LAYER_COLORS.services }} />
              <span>Business Logic</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: LAYER_COLORS.api }} />
              <span>API Layer</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: LAYER_COLORS.frontend }} />
              <span>Frontend</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: LAYER_COLORS.clients }} />
              <span>Users</span>
            </div>
          </div>
          <div className="border-t mt-2 pt-2 text-xs text-muted-foreground">
            <p>Click a node for details</p>
          </div>
        </Panel>

        {/* Reset Button Panel */}
        <Panel position="top-left" className="ml-2">
          <Button variant="outline" size="sm" onClick={onResetLayout} className="gap-2 bg-card">
            <Icon name="RotateCcw" size={14} />
            Reset Layout
          </Button>
        </Panel>
      </ReactFlow>

      {/* Detail Sidebar */}
      <Sheet open={!!selectedNode} onOpenChange={(open) => !open && setSelectedNode(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          {selectedNodeDetails && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selectedNodeDetails.title}
                </SheetTitle>
                <SheetDescription>
                  {selectedNodeDetails.description}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* Overview */}
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Icon name="Info" size={14} className="text-primary" />
                    Overview
                  </h4>
                  <ul className="space-y-1.5">
                    {selectedNodeDetails.details.map((detail, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Files */}
                {selectedNodeDetails.files && selectedNodeDetails.files.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <Icon name="FileCode" size={14} className="text-primary" />
                      Key Files
                    </h4>
                    <div className="space-y-1.5">
                      {selectedNodeDetails.files.map((file, i) => (
                        <div key={i} className="text-sm">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-primary">
                            {file.path}
                          </code>
                          <span className="text-muted-foreground ml-2 text-xs">
                            {file.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Functions */}
                {selectedNodeDetails.functions && selectedNodeDetails.functions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <Icon name="Code" size={14} className="text-primary" />
                      Key Functions
                    </h4>
                    <div className="space-y-1.5">
                      {selectedNodeDetails.functions.map((func, i) => (
                        <div key={i} className="text-sm flex items-start gap-2">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-foreground whitespace-nowrap">
                            {func.name}
                          </code>
                          <span className="text-muted-foreground text-xs">
                            {func.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Data Flow */}
                {((selectedNodeDetails.upstream && selectedNodeDetails.upstream.length > 0) ||
                  (selectedNodeDetails.downstream && selectedNodeDetails.downstream.length > 0)) && (
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <Icon name="GitBranch" size={14} className="text-primary" />
                      Data Flow
                    </h4>
                    <div className="space-y-2">
                      {selectedNodeDetails.upstream && selectedNodeDetails.upstream.length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-muted-foreground w-20 flex-shrink-0">Inputs:</span>
                          <div className="flex flex-wrap gap-1">
                            {selectedNodeDetails.upstream.map((nodeId, i) => (
                              <button
                                key={i}
                                onClick={() => setSelectedNode(nodeId)}
                                className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded hover:bg-green-500/20 transition-colors"
                              >
                                {NODE_DETAILS[nodeId]?.title || nodeId}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedNodeDetails.downstream && selectedNodeDetails.downstream.length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-muted-foreground w-20 flex-shrink-0">Outputs:</span>
                          <div className="flex flex-wrap gap-1">
                            {selectedNodeDetails.downstream.map((nodeId, i) => (
                              <button
                                key={i}
                                onClick={() => setSelectedNode(nodeId)}
                                className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded hover:bg-blue-500/20 transition-colors"
                              >
                                {NODE_DETAILS[nodeId]?.title || nodeId}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Monitoring & QA */}
                {selectedNodeDetails.monitoring && selectedNodeDetails.monitoring.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <Icon name="Activity" size={14} className="text-primary" />
                      Monitoring & QA
                    </h4>
                    <div className="space-y-1.5">
                      {selectedNodeDetails.monitoring.map((monitor, i) => (
                        <div key={i} className="text-sm flex items-start gap-2">
                          <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded whitespace-nowrap">
                            {monitor.tool}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {monitor.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Links */}
                {selectedNodeDetails.links && selectedNodeDetails.links.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <Icon name="ExternalLink" size={14} className="text-primary" />
                      Quick Links
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedNodeDetails.links.map((link, i) => (
                        <a
                          key={i}
                          href={link.path}
                          target={link.path.startsWith('http') ? '_blank' : undefined}
                          rel={link.path.startsWith('http') ? 'noopener noreferrer' : undefined}
                          className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors"
                        >
                          <Icon name={link.path.startsWith('http') ? 'ExternalLink' : 'ArrowRight'} size={12} />
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// Export with provider wrapper
export default function SystemDiagramFlow() {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </div>
  );
}
