# Currency Transition Plan - Future-Proofing WeWrite

## 🎯 **Overview**

This document outlines how WeWrite can transition from USD to a different main currency in the future, such as a new internet currency standard. The system is designed to be currency-agnostic with centralized configuration points.

---

## 📊 **Current Currency Dependencies Audit**

### **✅ Well-Abstracted Components (Easy to Change)**

#### **1. Currency Formatting & Display**
- **Location**: `app/utils/formatCurrency.ts`
- **Abstraction Level**: ✅ **EXCELLENT** - Already parameterized
- **Change Required**: Update default currency parameter

```typescript
// Current: formatCurrency(amount, 'USD')
// Future:  formatCurrency(amount, 'NEWCOIN')
export function formatCurrency(amount: number, currency: string = 'USD')
```

#### **2. Database Schema**
- **Location**: `app/types/database.ts`
- **Abstraction Level**: ✅ **GOOD** - Uses generic "cents" concept
- **Change Required**: Rename collections and update precision

```typescript
// Current: UsdBalance, UsdAllocation
// Future:  CurrencyBalance, CurrencyAllocation
// Precision: Configurable smallest unit (cents, satoshis, etc.)
```

#### **3. API Endpoints**
- **Location**: `app/api/usd/*`
- **Abstraction Level**: ✅ **GOOD** - Logic is currency-agnostic
- **Change Required**: Rename endpoints and update references

---

### **⚠️ Hardcoded Dependencies (Require Updates)**

#### **1. Collection Names**
- **Impact**: 🔴 **HIGH** - Database structure
- **Files**: All services, APIs, and utilities
- **Examples**: `usdBalances`, `usdAllocations`, `usdPayouts`

#### **2. Stripe Integration**
- **Impact**: 🔴 **HIGH** - Payment processing
- **Files**: `stripeProductManager.ts`, subscription APIs
- **Dependencies**: Stripe currency support, pricing structure

#### **3. Constants & Configuration**
- **Impact**: 🟡 **MEDIUM** - Business logic
- **Files**: `usdConstants.ts`, `subscriptionTiers.ts`
- **Examples**: Minimum amounts, tier pricing, processing rules

#### **4. UI Text & Labels**
- **Impact**: 🟡 **MEDIUM** - User experience
- **Files**: Components, UI constants
- **Examples**: "Fund Account", "USD Balance", button labels

---

## 🔧 **Transition Architecture**

### **Phase 1: Currency Abstraction Layer**

#### **1.1 Create Currency Configuration System**
```typescript
// app/config/currency.ts
export const CURRENCY_CONFIG = {
  // Primary currency settings
  PRIMARY_CURRENCY: process.env.PRIMARY_CURRENCY || 'USD',
  CURRENCY_SYMBOL: process.env.CURRENCY_SYMBOL || '$',
  CURRENCY_NAME: process.env.CURRENCY_NAME || 'US Dollar',
  
  // Precision settings
  SMALLEST_UNIT_NAME: process.env.SMALLEST_UNIT_NAME || 'cents',
  SMALLEST_UNIT_DIVISOR: parseInt(process.env.SMALLEST_UNIT_DIVISOR || '100'),
  
  // Display settings
  DECIMAL_PLACES: parseInt(process.env.CURRENCY_DECIMAL_PLACES || '2'),
  LOCALE: process.env.CURRENCY_LOCALE || 'en-US',
  
  // Business logic
  MIN_ALLOCATION_UNITS: parseInt(process.env.MIN_ALLOCATION_UNITS || '10'),
  MIN_PAYOUT_UNITS: parseInt(process.env.MIN_PAYOUT_UNITS || '2500'),
  
  // Payment processor settings
  PAYMENT_PROCESSOR: process.env.PAYMENT_PROCESSOR || 'stripe',
  PROCESSOR_CURRENCY_CODE: process.env.PROCESSOR_CURRENCY_CODE || 'usd'
} as const;
```

#### **1.2 Abstract Currency Utilities**
```typescript
// app/utils/currencyUtils.ts
import { CURRENCY_CONFIG } from '../config/currency';

export function formatCurrency(smallestUnits: number): string {
  const majorUnits = smallestUnits / CURRENCY_CONFIG.SMALLEST_UNIT_DIVISOR;
  return new Intl.NumberFormat(CURRENCY_CONFIG.LOCALE, {
    style: 'currency',
    currency: CURRENCY_CONFIG.PRIMARY_CURRENCY,
    minimumFractionDigits: CURRENCY_CONFIG.DECIMAL_PLACES,
    maximumFractionDigits: CURRENCY_CONFIG.DECIMAL_PLACES
  }).format(majorUnits);
}

export function majorUnitsToSmallestUnits(major: number): number {
  return Math.round(major * CURRENCY_CONFIG.SMALLEST_UNIT_DIVISOR);
}

export function smallestUnitsToMajorUnits(smallest: number): number {
  return smallest / CURRENCY_CONFIG.SMALLEST_UNIT_DIVISOR;
}
```

#### **1.3 Dynamic Collection Names**
```typescript
// app/utils/collectionNames.ts
import { CURRENCY_CONFIG } from '../config/currency';

export function getCurrencyCollectionName(baseCollection: string): string {
  const currencyPrefix = CURRENCY_CONFIG.PRIMARY_CURRENCY.toLowerCase();
  return `${currencyPrefix}${baseCollection.charAt(0).toUpperCase()}${baseCollection.slice(1)}`;
}

// Usage:
// getCurrencyCollectionName('balances') → 'usdBalances' or 'btcBalances'
// getCurrencyCollectionName('allocations') → 'usdAllocations' or 'btcAllocations'
```

---

### **Phase 2: Migration Strategy**

#### **2.1 Dual-Currency Support Period**
```typescript
// Support both old and new currency during transition
export const MIGRATION_CONFIG = {
  MIGRATION_MODE: process.env.MIGRATION_MODE || 'single', // 'single' | 'dual' | 'transitioning'
  OLD_CURRENCY: 'USD',
  NEW_CURRENCY: process.env.NEW_CURRENCY || 'USD',
  CONVERSION_RATE: parseFloat(process.env.CONVERSION_RATE || '1.0'),
  MIGRATION_DEADLINE: process.env.MIGRATION_DEADLINE || null
};
```

#### **2.2 Data Migration Scripts**
```typescript
// scripts/migrate-currency.ts
export async function migrateCurrencyData(
  fromCurrency: string,
  toCurrency: string,
  conversionRate: number
) {
  // 1. Create new currency collections
  // 2. Convert and copy data with conversion rate
  // 3. Update user balances and allocations
  // 4. Migrate payment processor settings
  // 5. Update subscription pricing
  // 6. Audit and verify conversion accuracy
}
```

---

### **Phase 3: Payment Processor Integration**

#### **3.1 Abstract Payment Processor Interface**
```typescript
// app/services/paymentProcessor.ts
export interface PaymentProcessor {
  createPrice(amount: number, currency: string): Promise<string>;
  createSubscription(customerId: string, priceId: string): Promise<any>;
  processPayment(amount: number, currency: string): Promise<any>;
  getSupportedCurrencies(): string[];
  getMinimumAmount(currency: string): number;
}

export class StripeProcessor implements PaymentProcessor {
  // Stripe-specific implementation
}

export class NewCurrencyProcessor implements PaymentProcessor {
  // New currency processor implementation
}
```

#### **3.2 Currency-Specific Business Logic**
```typescript
// app/config/currencyRules.ts
export const CURRENCY_RULES = {
  USD: {
    minAllocation: 10, // 10 cents
    minPayout: 2500,   // $25.00
    processingDay: 1,  // 1st of month
    feePercentage: 7   // 7% platform fee
  },
  BTC: {
    minAllocation: 1000,    // 1000 satoshis
    minPayout: 100000,      // 0.001 BTC
    processingDay: 1,       // 1st of month
    feePercentage: 7        // 7% platform fee
  },
  NEWCOIN: {
    minAllocation: 1,       // 1 smallest unit
    minPayout: 1000,        // 1000 smallest units
    processingDay: 1,       // 1st of month
    feePercentage: 7        // 7% platform fee
  }
};
```

---

## 🚀 **Implementation Roadmap**

### **Step 1: Preparation (1-2 weeks)**
1. **Create currency configuration system**
2. **Abstract currency utilities and formatting**
3. **Implement dynamic collection naming**
4. **Add currency-agnostic database types**

### **Step 2: Backend Abstraction (2-3 weeks)**
1. **Update all services to use currency config**
2. **Abstract payment processor interface**
3. **Create currency-specific business rules**
4. **Update API endpoints to be currency-agnostic**

### **Step 3: Frontend Updates (1-2 weeks)**
1. **Update UI components to use currency config**
2. **Abstract currency display logic**
3. **Update button labels and text**
4. **Add currency selection interface (if needed)**

### **Step 4: Migration Tools (1 week)**
1. **Create data migration scripts**
2. **Build conversion and audit tools**
3. **Implement dual-currency support**
4. **Create rollback procedures**

### **Step 5: Testing & Deployment (1-2 weeks)**
1. **Comprehensive testing with new currency**
2. **Gradual rollout with feature flags**
3. **Monitor conversion accuracy**
4. **User communication and support**

---

## 📋 **Transition Checklist**

### **Configuration Updates**
- [ ] Set new currency environment variables
- [ ] Update payment processor settings
- [ ] Configure conversion rates
- [ ] Set migration timeline

### **Database Migration**
- [ ] Create new currency collections
- [ ] Migrate user balances with conversion
- [ ] Update allocation records
- [ ] Migrate payout history
- [ ] Verify data integrity

### **Payment Integration**
- [ ] Update Stripe/payment processor currency
- [ ] Create new pricing tiers
- [ ] Update subscription products
- [ ] Test payment flows
- [ ] Update webhook handling

### **User Interface**
- [ ] Update currency symbols and labels
- [ ] Modify subscription checkout
- [ ] Update balance displays
- [ ] Change allocation interfaces
- [ ] Update earnings pages

### **Business Logic**
- [ ] Update minimum amounts
- [ ] Adjust fee calculations
- [ ] Modify payout thresholds
- [ ] Update processing schedules
- [ ] Verify platform fee handling

---

## 🎯 **Currency-Specific Considerations**

### **For Cryptocurrency (e.g., Bitcoin)**
- **Precision**: Use satoshis (1/100,000,000 BTC)
- **Volatility**: Implement price stabilization mechanisms
- **Processing**: Consider blockchain confirmation times
- **Regulation**: Ensure compliance with crypto regulations
- **Wallets**: Integrate with crypto wallet providers

### **For Stablecoins (e.g., USDC)**
- **Precision**: Use smallest denomination
- **Stability**: Leverage price stability benefits
- **Processing**: Faster than traditional crypto
- **Integration**: Use DeFi protocols for payments
- **Custody**: Implement secure wallet management

### **For CBDCs (Central Bank Digital Currencies)**
- **Precision**: Follow central bank specifications
- **Integration**: Use official CBDC APIs
- **Compliance**: Adhere to government regulations
- **Processing**: Leverage instant settlement
- **Adoption**: Plan for gradual rollout

---

## 🔒 **Risk Mitigation**

### **Technical Risks**
- **Data Loss**: Comprehensive backup and rollback procedures
- **Conversion Errors**: Multiple validation layers and audit trails
- **Integration Failures**: Gradual rollout with feature flags
- **Performance Issues**: Load testing with new currency

### **Business Risks**
- **User Confusion**: Clear communication and migration guides
- **Revenue Impact**: Careful pricing strategy for new currency
- **Regulatory Issues**: Legal review of new currency adoption
- **Market Volatility**: Hedging strategies for volatile currencies

---

## 🎉 **Success Metrics**

### **Technical Success**
- ✅ **Zero data loss** during migration
- ✅ **100% conversion accuracy** within acceptable tolerance
- ✅ **All payment flows working** with new currency
- ✅ **Performance maintained** or improved

### **Business Success**
- ✅ **User adoption rate** of new currency
- ✅ **Revenue maintained** or increased
- ✅ **Creator satisfaction** with new payout system
- ✅ **Platform growth** continues post-transition

---

## 📚 **Documentation Updates Required**

1. **Update all API documentation** with new currency
2. **Revise user guides** and help articles
3. **Update developer documentation** for integrations
4. **Create migration guides** for users and creators
5. **Document new business rules** and fee structures

---

## 🚀 **Conclusion**

WeWrite's architecture is **well-positioned for currency transition** with the following strengths:

- ✅ **Centralized currency formatting** already parameterized
- ✅ **Generic database schema** using "smallest units" concept
- ✅ **Modular payment processing** ready for abstraction
- ✅ **Clear separation** between business logic and currency specifics

**Estimated transition time: 6-10 weeks** depending on new currency complexity and testing requirements.

**The system can be transitioned to any new currency with proper planning and execution!** 🌟

---

## 📊 **Current System Analysis**

### **Currency Coupling Assessment**

#### **🟢 LOW COUPLING (Easy to Change)**
- **Currency Formatting**: Already parameterized with currency codes
- **Database Precision**: Uses "cents" concept (smallest units)
- **Business Logic**: Mostly currency-agnostic calculations
- **API Structure**: Generic allocation and balance logic

#### **🟡 MEDIUM COUPLING (Moderate Effort)**
- **Collection Names**: `usdBalances`, `usdAllocations` (rename required)
- **API Endpoints**: `/api/usd/*` (path updates needed)
- **UI Text**: "USD Balance", "Fund Account" (label updates)
- **Constants**: Hardcoded USD amounts in config files

#### **🔴 HIGH COUPLING (Significant Effort)**
- **Stripe Integration**: Currency-specific pricing and products
- **Migration Scripts**: USD-specific conversion logic
- **Documentation**: Extensive USD references throughout
- **Environment Variables**: USD-prefixed configuration keys

### **Transition Difficulty: 🟡 MODERATE (6-10 weeks)**

The system is **better positioned than most** for currency transition due to:
- Generic "smallest units" architecture
- Parameterized formatting functions
- Modular service architecture
- Clear separation of concerns

---

## 🛠️ **Quick Start Implementation**

### **Immediate Steps (Week 1)**
```bash
# 1. Create currency configuration
touch app/config/currency.ts

# 2. Abstract currency utilities
cp app/utils/formatCurrency.ts app/utils/currencyUtils.ts

# 3. Add environment variables
echo "PRIMARY_CURRENCY=USD" >> .env.local
echo "CURRENCY_SYMBOL=$" >> .env.local
echo "SMALLEST_UNIT_DIVISOR=100" >> .env.local
```

### **Priority Files to Update**
1. **`app/config/currency.ts`** - Central configuration
2. **`app/utils/currencyUtils.ts`** - Abstract formatting
3. **`app/utils/collectionNames.ts`** - Dynamic collection naming
4. **`app/services/paymentProcessor.ts`** - Abstract payment interface
5. **`app/types/currency.ts`** - Currency-agnostic types

---

## 🎯 **Future Currency Examples**

### **Bitcoin Transition Example**
```typescript
// Configuration for Bitcoin
export const BTC_CONFIG = {
  PRIMARY_CURRENCY: 'BTC',
  CURRENCY_SYMBOL: '₿',
  SMALLEST_UNIT_NAME: 'satoshis',
  SMALLEST_UNIT_DIVISOR: 100000000, // 1 BTC = 100M satoshis
  MIN_ALLOCATION_UNITS: 1000,       // 1000 satoshis
  MIN_PAYOUT_UNITS: 100000,         // 0.001 BTC
  DECIMAL_PLACES: 8
};
```

### **USDC Stablecoin Example**
```typescript
// Configuration for USDC
export const USDC_CONFIG = {
  PRIMARY_CURRENCY: 'USDC',
  CURRENCY_SYMBOL: 'USDC',
  SMALLEST_UNIT_NAME: 'micro-USDC',
  SMALLEST_UNIT_DIVISOR: 1000000,   // 1 USDC = 1M micro-USDC
  MIN_ALLOCATION_UNITS: 100000,     // $0.10
  MIN_PAYOUT_UNITS: 25000000,       // $25.00
  DECIMAL_PLACES: 6
};
```

### **Hypothetical Internet Currency**
```typescript
// Configuration for future internet currency
export const NETCOIN_CONFIG = {
  PRIMARY_CURRENCY: 'NETCOIN',
  CURRENCY_SYMBOL: 'Ⓝ',
  SMALLEST_UNIT_NAME: 'nanos',
  SMALLEST_UNIT_DIVISOR: 1000000000, // 1 NETCOIN = 1B nanos
  MIN_ALLOCATION_UNITS: 1000000,     // 0.001 NETCOIN
  MIN_PAYOUT_UNITS: 25000000000,     // 25 NETCOIN
  DECIMAL_PLACES: 9
};
```
