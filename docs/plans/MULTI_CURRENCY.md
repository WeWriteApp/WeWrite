# Multi-Currency & Cryptocurrency Roadmap

## Overview
Enable WeWrite to support multiple fiat currencies and cryptocurrencies for allocations and payouts, with special focus on privacy-preserving options like Monero (XMR).

**Status**: Planning phase

---

## Motivation
- **Global reach**: Users in EUR/GBP regions pay in local currency
- **Privacy**: Monero provides transaction privacy for writers
- **Decentralization**: Reduce dependence on traditional payment rails
- **Lower fees**: Crypto payouts may have lower transaction costs

---

## Current State Analysis

WeWrite already has excellent infrastructure for multi-currency support:

| Component | Status | Notes |
|-----------|--------|-------|
| Currency Config System | Ready | `/app/config/currency.ts` - presets for USD, EUR, BTC, USDC |
| Collection Naming | Hardcoded | Uses `usd_*` prefixes, needs dynamic naming |
| Stripe Integration | Ready | Stripe supports 135+ currencies |
| Amount Storage | Ready | All amounts in smallest units (cents/satoshis) |
| Monero Support | Not started | Requires new wallet service |

---

## Phase 1: Multi-Currency Fiat

### Goals
- Support EUR, GBP, CAD, AUD via Stripe
- Single-currency per deployment (not multi-currency per user initially)

### Implementation

#### 1. Activate Currency Config (`app/config/currency.ts`)
- Set `PRIMARY_CURRENCY` environment variable
- System already supports USD/EUR/BTC presets

#### 2. Dynamic Collection Names
- Replace hardcoded `usd_*` collections
- Create `getCurrencyCollectionName(base)` helper
- Example: `allocations` → `eur_allocations` or `usd_allocations`

#### 3. Stripe Currency Update
- Use `CURRENCY_CONFIG.PROCESSOR_CURRENCY_CODE` in all Stripe calls
- Update price creation, subscription, and transfer APIs

#### 4. Format Currency Updates
- Update `formatCurrency.ts` to use config decimals
- Support currency symbols from config

### Files to Modify
- `app/config/currency.ts` - Already ready, just needs activation
- `app/utils/environmentConfig.ts` - Add dynamic collection naming
- `app/utils/formatCurrency.ts` - Use config for formatting
- `app/api/subscription/create-simple/route.ts` - Dynamic currency
- `app/services/payoutService.ts` - Dynamic currency in transfers

---

## Phase 2: Cryptocurrency Foundation

### Goals
- Abstract payment processor interface
- Real-time exchange rates
- Crypto-specific compliance

### Payment Processor Interface

```typescript
interface PaymentProcessor {
  name: string;
  supportedCurrencies: string[];

  // Deposits (subscriptions)
  createPaymentIntent(amount: number, currency: string): Promise<PaymentIntent>;

  // Payouts
  createPayout(recipient: PayoutRecipient, amount: number): Promise<Payout>;

  // Verification
  verifyTransaction(txId: string): Promise<TransactionStatus>;
}

// Implementations
class StripeProcessor implements PaymentProcessor { }  // USD, EUR, etc.
class MoneroProcessor implements PaymentProcessor { }  // XMR
```

### Exchange Rate Service

```typescript
// app/services/exchangeRateService.ts
interface ExchangeRateService {
  getRate(from: string, to: string): Promise<number>;
  convertAmount(amount: number, from: string, to: string): Promise<number>;
}

// Sources: CoinGecko, Kraken, custom oracle
```

### Data Model Extensions

```typescript
interface Allocation {
  // Existing fields...
  currency: string;           // 'USD', 'EUR', 'XMR'
  originalAmountUnits: number; // Amount in currency's smallest unit
  usdEquivalentCents?: number; // For reporting/comparison
}

interface Payout {
  // Existing fields...
  currency: string;
  processorType: 'stripe' | 'monero' | 'bitcoin';
  txHash?: string;            // Blockchain transaction hash
  confirmations?: number;     // Block confirmations
}
```

---

## Phase 3: Monero (XMR) Integration

### Why Monero?
- **Privacy**: Ring signatures hide sender/receiver
- **Fungibility**: All XMR is equal (no "tainted" coins)
- **Low fees**: Typically <$0.01 per transaction
- **Alignment**: Supports independent writers' privacy

### Technical Architecture

#### Monero Wallet Service

```typescript
// app/services/moneroWalletService.ts
class MoneroWalletService {
  private rpcClient: MoneroRPC;

  // Generate subaddress for each user (privacy)
  async generateDepositAddress(userId: string): Promise<string>;

  // Check incoming transactions
  async getIncomingTransactions(minHeight: number): Promise<MoneroTx[]>;

  // Send payout
  async sendPayout(address: string, amountPiconero: bigint): Promise<string>;

  // Verify transaction confirmations
  async getConfirmations(txHash: string): Promise<number>;
}
```

#### Infrastructure Requirements
- **Monero Node**: Full node or trusted remote node
- **Wallet RPC**: monero-wallet-rpc daemon
- **Cold Storage**: Majority of funds in cold wallet

#### Payout Flow
1. Writer requests XMR payout
2. Verify earnings and minimum threshold
3. Convert USD earnings to XMR equivalent
4. Submit transaction via wallet RPC
5. Monitor for 10 confirmations (~20 min)
6. Mark payout complete

### Security Considerations
- **View-only keys**: For balance monitoring without spend authority
- **Multi-sig**: Optional for large payouts
- **Rate limits**: Prevent rapid withdrawal attacks
- **Address validation**: Verify valid Monero addresses

### Compliance
- **KYC**: May require enhanced verification for crypto payouts
- **Limits**: Lower initial limits for crypto ($1000/month)
- **Reporting**: Track USD equivalent at time of payout
- **Travel Rule**: May apply for certain jurisdictions

---

## Data Model Summary

### New Collections (per currency)
- `{currency}_balances` - Subscriber balances
- `{currency}_allocations` - Allocation records
- `{currency}_earnings` - Writer earnings
- `{currency}_payouts` - Payout records

### New Fields
- `currency: string` on all financial records
- `exchangeRate: number` for cross-currency reference
- `txHash: string` for blockchain transactions
- `confirmations: number` for blockchain payouts

---

## API Changes

### New Endpoints
- `GET /api/exchange-rates` - Current rates
- `POST /api/payouts/crypto` - Crypto payout request
- `GET /api/payouts/[id]/status` - Payout with confirmation status

### Modified Endpoints
- All existing financial endpoints add `currency` parameter
- Payout endpoints support multiple processor types

---

## Environment Variables

```bash
# Currency Configuration
PRIMARY_CURRENCY=USD  # or EUR, XMR, etc.
CURRENCY_MODE=single  # single, dual, transitioning

# Monero Configuration (Phase 3)
MONERO_WALLET_RPC_URL=http://localhost:18082
MONERO_WALLET_RPC_USER=monero
MONERO_WALLET_RPC_PASSWORD=secret
MONERO_NETWORK=mainnet  # mainnet, stagenet, testnet

# Exchange Rates
EXCHANGE_RATE_PROVIDER=coingecko
COINGECKO_API_KEY=optional_for_higher_limits
```

---

## Rollout Strategy

### Phase 1: Fiat Currencies (Low Risk)
1. Deploy EUR instance for EU users
2. Separate deployment, separate Stripe account
3. No currency conversion needed

### Phase 2: Crypto Foundation (Medium Risk)
1. Add exchange rate service
2. Build processor abstraction
3. Test with testnet/stagenet

### Phase 3: Monero Production (Higher Risk)
1. Start with invite-only beta
2. Low limits ($100 payouts)
3. Gradually increase limits
4. Full rollout after 3 months

---

## Open Questions

1. **Per-user currency selection?**
   - v1: Single currency per deployment
   - v2: User chooses currency preference

2. **Cross-currency allocations?**
   - Can USD subscriber allocate to XMR-denominated page?
   - Requires real-time conversion

3. **Exchange rate risk?**
   - Who bears volatility between allocation and payout?
   - Options: Lock rate at allocation, real-time at payout

4. **Minimum payouts per currency?**
   - USD: $25 (current)
   - EUR: €25
   - XMR: ~0.15 XMR (~$25 equivalent)

---

## Related Documentation
- [Private Pages](./PRIVATE_PAGES.md)
- [Groups](./GROUPS.md)
- [Current Architecture](../architecture/CURRENT_ARCHITECTURE.md)
