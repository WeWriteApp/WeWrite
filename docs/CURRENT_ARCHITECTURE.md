# WeWrite Current Architecture Guide

## Overview

WeWrite uses a **simplified, USD-based architecture** that prioritizes maintainability, performance, and user experience. This document outlines the current system architecture after major simplifications completed in 2024-2025.

## 🎯 Architecture Principles

### 1. Simplicity Over Complexity
- **Single responsibility**: Each service does ONE thing well
- **No complex patterns**: Avoid abstractions, factories, and complex inheritance
- **Clear data flow**: Linear subscription → allocation → payout flow
- **Obvious implementations**: Code should be self-explanatory

### 2. API-First Design
- **Frontend components** use simple API calls instead of direct service imports
- **Backend services** handle all business logic server-side
- **No Firebase Admin in browser**: Eliminates Node.js module conflicts
- **Environment-aware APIs**: Automatic dev/prod collection routing

### 3. Performance Optimized
- **Aggressive caching**: 15-minute API caches, persistent storage
- **Separated contexts**: Independent data loading for balance, subscription, earnings
- **Optimized queries**: Minimal database reads with smart indexing
- **Real-time listeners eliminated**: Replaced with cached API calls

## 🏗️ System Architecture

### Core Data Flow

```
User Subscription → USD Balance → Allocations → Creator Earnings → Payouts
```

### Key Components

#### 1. Authentication System
- **Firebase Auth**: User authentication and session management
- **Environment-aware**: Separate dev/prod user collections
- **Multi-account support**: Device management and logout capabilities

#### 2. Subscription Management
- **Stripe Integration**: Monthly subscriptions ($10, $20, $30)
- **Webhook Processing**: Real-time subscription status updates
- **USD Balance Creation**: Automatic balance setup on subscription

#### 3. USD Allocation System
- **Direct USD Allocations**: No virtual currency conversion
- **Monthly Tracking**: Allocations tracked by month (YYYY-MM)
- **Real-time Updates**: Optimistic UI with background API calls

#### 4. Rich Text Editor System
- **Single Editor Implementation**: One canonical `Editor` component (formerly SimplifiedSlateEditor)
- **Inline Pill Links**: Links rendered as interactive pill components using `LinkNode`
- **LinkNodeHelper Integration**: Consistent link creation using documented helper functions
- **Slate.js Foundation**: Built on Slate.js with React integration
- **No Fallback Editors**: Single, reliable implementation eliminates complexity
- **Error Recovery**: Graceful handling of content normalization and DOM sync issues
- **Batch Operations**: Efficient multi-allocation updates

#### 4. Earnings Processing
- **Monthly Calculation**: End-of-month earnings calculation
- **Status Transitions**: pending → available → paid_out
- **Platform Fees**: 10% platform fee on all earnings
- **Balance Aggregation**: Real-time balance calculation from earnings records

#### 5. Payout System
- **Stripe Connect**: Bank account management and transfers
- **Minimum Threshold**: $25.00 minimum payout
- **Automated Processing**: Monthly payout processing via cron
- **Status Tracking**: Real-time payout status updates

### "Use It or Lose It" Model
WeWrite's innovative **"Use It or Lose It"** system encourages user engagement:
- Users must actively allocate their subscription funds each month
- Unallocated funds automatically become platform revenue at month-end
- This creates sustainable platform revenue while encouraging creator support

#### Monthly Cycle
1. **Days 1-31**: Users allocate subscription funds to creators
2. **Month-End**: Allocations lock, earnings calculated
3. **1st of Next Month**: Eligible creators receive payouts
4. **Platform Revenue**: Unallocated funds transferred to business account

## 🗄️ Database Architecture

### Environment Separation
- **Development**: `DEV_` prefixed collections
- **Production**: Standard collection names
- **Automatic Routing**: Environment-aware collection name resolution

### Core Collections

#### User Management
- `users` - User profiles and settings
- `subscriptions` - Stripe subscription data

#### USD System
- `usdBalances` - User subscription balances
- `usdAllocations` - Monthly allocations to creators
- `writerUsdBalances` - Creator earnings summary
- `writerUsdEarnings` - Detailed monthly earnings records

#### Content System
- `pages` - User-generated content (see [PAGE_DATA_AND_VERSIONS.md](PAGE_DATA_AND_VERSIONS.md))
- `recentEdits` - Recent page modifications
- `pageVersions` - Page version history (see [PAGE_DATA_AND_VERSIONS.md](PAGE_DATA_AND_VERSIONS.md))

### Data Consistency
- **Atomic Transactions**: Critical operations use Firestore transactions
- **Balance Reconciliation**: Regular balance validation against earnings
- **Audit Trails**: Complete operation logging with correlation IDs

## 🔄 Financial Data Architecture

### Separated Contexts
WeWrite uses **four dedicated financial contexts** instead of a monolithic system:

#### 1. UsdBalanceContext
- **Purpose**: Real USD balance data only
- **Scope**: Authenticated users with active subscriptions
- **Cache**: 30-minute cache with persistent storage

#### 2. SubscriptionContext
- **Purpose**: Stripe subscription status and amounts
- **Scope**: All authenticated users
- **Cache**: 15-minute cache

#### 3. EarningsContext
- **Purpose**: Creator earnings and payout data
- **Scope**: Users with earnings
- **Cache**: 10-minute cache (more dynamic)

#### 4. FakeBalanceContext
- **Purpose**: Demo balance for non-subscribers
- **Scope**: Users without active subscriptions
- **Storage**: localStorage only

### Benefits
- **Single Responsibility**: Each context has one clear purpose
- **Optimized Performance**: Components only load data they need
- **Independent Caching**: Different cache strategies per data type
- **Better Testing**: Each context can be tested independently

## 🚀 Performance Optimizations

### Database Read Reduction (90% improvement)
- **API Caching**: 10-15 minute server-side caches
- **HTTP Headers**: Browser and CDN caching
- **Real-time Listener Elimination**: Replaced with cached API calls
- **Query Optimization**: Reduced query complexity and frequency

### Frontend Optimizations
- **Separated Contexts**: Independent data loading
- **Optimistic Updates**: UI updates before API confirmation
- **Persistent Caching**: localStorage for stable data
- **Batch Operations**: Multiple allocations in single API call

### Backend Optimizations
- **Connection Pooling**: Efficient database connections
- **Query Indexing**: Optimized Firestore indexes
- **Correlation Tracking**: Operation tracing for debugging
- **Error Handling**: Graceful degradation and recovery

## 🔧 Development Architecture

### Environment Management
- **Branch-aware Development**: Automatic environment detection
- **Collection Prefixing**: Isolated dev/prod data
- **API Key Management**: Environment-specific configurations
- **Testing Infrastructure**: Comprehensive test data and flows

### Code Organization
- **Service Layer**: Server-side business logic
- **API Layer**: RESTful endpoints with consistent patterns
- **Component Layer**: Reusable UI components
- **Context Layer**: State management and data fetching

### Quality Assurance
- **TypeScript**: Full type safety across the stack
- **Error Boundaries**: Graceful error handling
- **Logging**: Comprehensive operation logging
- **Testing**: Unit, integration, and end-to-end tests

## 🔒 Security Architecture

### Authentication
- **Firebase Auth**: Industry-standard authentication
- **Session Management**: Secure session handling
- **Multi-device Support**: Device tracking and management

### Data Protection
- **Server-side Validation**: All business logic server-side
- **API Authentication**: Secure API endpoint access
- **Data Encryption**: Encrypted data transmission
- **Access Control**: Role-based permissions

### Financial Security
- **Stripe Integration**: PCI-compliant payment processing
- **Audit Trails**: Complete financial operation logging
- **Balance Validation**: Regular balance reconciliation
- **Fraud Prevention**: Transaction monitoring and validation

## 📊 Monitoring & Observability

### System Health
- **API Performance**: Response time and error rate monitoring
- **Database Performance**: Query performance and cost tracking
- **Financial Accuracy**: Balance reconciliation and validation
- **User Experience**: Error tracking and user feedback

### Business Metrics
- **Subscription Growth**: User acquisition and retention
- **Allocation Patterns**: User engagement with creators
- **Payout Success**: Creator satisfaction and payout reliability
- **Platform Revenue**: Fee collection and unallocated funds

## 🔄 Migration History

### Completed Migrations
- ✅ **Token to USD Migration** (2024): Eliminated virtual currency
- ✅ **Architecture Simplification** (2024): Reduced complexity by 80%
- ✅ **Context Separation** (2025): Improved performance and maintainability
- ✅ **Firebase Optimization** (2025): 90% reduction in database costs

### Current Status
- **System**: Fully operational USD-based architecture
- **Performance**: Optimized for scale and cost efficiency
- **Maintainability**: Simplified codebase with clear patterns
- **User Experience**: Fast, reliable, and intuitive

## 📚 Related Documentation

- [PAYMENT_SYSTEM_GUIDE.md](./PAYMENT_SYSTEM_GUIDE.md) - Complete payment system overview
- [FINANCIAL_DATA_ARCHITECTURE.md](./FINANCIAL_DATA_ARCHITECTURE.md) - Detailed financial context architecture
- [SUBSCRIPTION_SYSTEM.md](./SUBSCRIPTION_SYSTEM.md) - Subscription management details
- [SIMPLIFIED_PAYOUT_SYSTEM.md](./SIMPLIFIED_PAYOUT_SYSTEM.md) - Payout system architecture

---

**Last Updated**: August 16, 2025  
**Status**: Current Production Architecture
