/**
 * Currency Configuration System
 * 
 * Centralized configuration for WeWrite's currency system.
 * Designed to support easy transition to different currencies.
 */

// Environment-based currency configuration
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
  PROCESSOR_CURRENCY_CODE: process.env.PROCESSOR_CURRENCY_CODE || 'usd',
  
  // Platform fee (as percentage) - DEPRECATED: Use app/config/platformFee.ts instead
  // This is kept for backward compatibility but platformFee.ts is the source of truth
  PLATFORM_FEE_PERCENTAGE: parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '10.0')
} as const;

// Migration configuration for currency transitions
export const MIGRATION_CONFIG = {
  MIGRATION_MODE: process.env.MIGRATION_MODE || 'single', // 'single' | 'dual' | 'transitioning'
  OLD_CURRENCY: process.env.OLD_CURRENCY || 'USD',
  NEW_CURRENCY: process.env.NEW_CURRENCY || 'USD',
  CONVERSION_RATE: parseFloat(process.env.CONVERSION_RATE || '1.0'),
  MIGRATION_DEADLINE: process.env.MIGRATION_DEADLINE || null,
  DUAL_CURRENCY_PERIOD_DAYS: parseInt(process.env.DUAL_CURRENCY_PERIOD_DAYS || '30')
} as const;

// Predefined currency configurations
export const CURRENCY_PRESETS = {
  USD: {
    PRIMARY_CURRENCY: 'USD',
    CURRENCY_SYMBOL: '$',
    CURRENCY_NAME: 'US Dollar',
    SMALLEST_UNIT_NAME: 'cents',
    SMALLEST_UNIT_DIVISOR: 100,
    DECIMAL_PLACES: 2,
    LOCALE: 'en-US',
    MIN_ALLOCATION_UNITS: 10,     // $0.10
    MIN_PAYOUT_UNITS: 2500,       // $25.00
    PROCESSOR_CURRENCY_CODE: 'usd'
  },
  
  BTC: {
    PRIMARY_CURRENCY: 'BTC',
    CURRENCY_SYMBOL: '₿',
    CURRENCY_NAME: 'Bitcoin',
    SMALLEST_UNIT_NAME: 'satoshis',
    SMALLEST_UNIT_DIVISOR: 100000000, // 1 BTC = 100M satoshis
    DECIMAL_PLACES: 8,
    LOCALE: 'en-US',
    MIN_ALLOCATION_UNITS: 1000,       // 1000 satoshis (~$0.10 at $50k BTC)
    MIN_PAYOUT_UNITS: 50000,          // 50000 satoshis (~$25 at $50k BTC)
    PROCESSOR_CURRENCY_CODE: 'btc'
  },
  
  USDC: {
    PRIMARY_CURRENCY: 'USDC',
    CURRENCY_SYMBOL: 'USDC',
    CURRENCY_NAME: 'USD Coin',
    SMALLEST_UNIT_NAME: 'micro-USDC',
    SMALLEST_UNIT_DIVISOR: 1000000,   // 1 USDC = 1M micro-USDC
    DECIMAL_PLACES: 6,
    LOCALE: 'en-US',
    MIN_ALLOCATION_UNITS: 100000,     // $0.10
    MIN_PAYOUT_UNITS: 25000000,       // $25.00
    PROCESSOR_CURRENCY_CODE: 'usdc'
  },
  
  EUR: {
    PRIMARY_CURRENCY: 'EUR',
    CURRENCY_SYMBOL: '€',
    CURRENCY_NAME: 'Euro',
    SMALLEST_UNIT_NAME: 'cents',
    SMALLEST_UNIT_DIVISOR: 100,
    DECIMAL_PLACES: 2,
    LOCALE: 'de-DE',
    MIN_ALLOCATION_UNITS: 10,         // €0.10
    MIN_PAYOUT_UNITS: 2500,           // €25.00
    PROCESSOR_CURRENCY_CODE: 'eur'
  },
  
  // Hypothetical future internet currency
  NETCOIN: {
    PRIMARY_CURRENCY: 'NETCOIN',
    CURRENCY_SYMBOL: 'Ⓝ',
    CURRENCY_NAME: 'NetCoin',
    SMALLEST_UNIT_NAME: 'nanos',
    SMALLEST_UNIT_DIVISOR: 1000000000, // 1 NETCOIN = 1B nanos
    DECIMAL_PLACES: 9,
    LOCALE: 'en-US',
    MIN_ALLOCATION_UNITS: 1000000,     // 0.001 NETCOIN
    MIN_PAYOUT_UNITS: 25000000000,     // 25 NETCOIN
    PROCESSOR_CURRENCY_CODE: 'netcoin'
  }
} as const;

// Helper functions
export function getCurrentCurrencyConfig() {
  const presetKey = CURRENCY_CONFIG.PRIMARY_CURRENCY as keyof typeof CURRENCY_PRESETS;
  const preset = CURRENCY_PRESETS[presetKey];
  
  if (preset) {
    // Use preset values as defaults, but allow environment overrides
    return {
      ...preset,
      ...Object.fromEntries(
        Object.entries(CURRENCY_CONFIG).filter(([_, value]) => 
          value !== undefined && value !== '' && !isNaN(Number(value))
        )
      )
    };
  }
  
  return CURRENCY_CONFIG;
}

export function getCurrencyCollectionName(baseCollection: string): string {
  const currencyPrefix = CURRENCY_CONFIG.PRIMARY_CURRENCY.toLowerCase();
  return `${currencyPrefix}${baseCollection.charAt(0).toUpperCase()}${baseCollection.slice(1)}`;
}

export function isMigrationMode(): boolean {
  return MIGRATION_CONFIG.MIGRATION_MODE !== 'single';
}

export function isDualCurrencyMode(): boolean {
  return MIGRATION_CONFIG.MIGRATION_MODE === 'dual';
}

export function isTransitioningMode(): boolean {
  return MIGRATION_CONFIG.MIGRATION_MODE === 'transitioning';
}

// Validation functions
export function validateCurrencyConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = getCurrentCurrencyConfig();
  
  if (!config.PRIMARY_CURRENCY) {
    errors.push('PRIMARY_CURRENCY is required');
  }
  
  if (!config.CURRENCY_SYMBOL) {
    errors.push('CURRENCY_SYMBOL is required');
  }
  
  if (config.SMALLEST_UNIT_DIVISOR <= 0) {
    errors.push('SMALLEST_UNIT_DIVISOR must be positive');
  }
  
  if (config.MIN_ALLOCATION_UNITS <= 0) {
    errors.push('MIN_ALLOCATION_UNITS must be positive');
  }
  
  if (config.MIN_PAYOUT_UNITS <= config.MIN_ALLOCATION_UNITS) {
    errors.push('MIN_PAYOUT_UNITS must be greater than MIN_ALLOCATION_UNITS');
  }
  
  if (config.PLATFORM_FEE_PERCENTAGE < 0 || config.PLATFORM_FEE_PERCENTAGE > 100) {
    errors.push('PLATFORM_FEE_PERCENTAGE must be between 0 and 100');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Export current configuration
export const CURRENT_CURRENCY = getCurrentCurrencyConfig();

// Type definitions
export type CurrencyCode = keyof typeof CURRENCY_PRESETS;
export type MigrationMode = 'single' | 'dual' | 'transitioning';

export interface CurrencyConfiguration {
  PRIMARY_CURRENCY: string;
  CURRENCY_SYMBOL: string;
  CURRENCY_NAME: string;
  SMALLEST_UNIT_NAME: string;
  SMALLEST_UNIT_DIVISOR: number;
  DECIMAL_PLACES: number;
  LOCALE: string;
  MIN_ALLOCATION_UNITS: number;
  MIN_PAYOUT_UNITS: number;
  PROCESSOR_CURRENCY_CODE: string;
  PLATFORM_FEE_PERCENTAGE?: number;
}

// Usage examples:
// 
// To switch to Bitcoin:
// Set environment variables:
// PRIMARY_CURRENCY=BTC
// CURRENCY_SYMBOL=₿
// SMALLEST_UNIT_DIVISOR=100000000
// 
// To switch to a custom currency:
// PRIMARY_CURRENCY=MYCOIN
// CURRENCY_SYMBOL=Ⓜ
// SMALLEST_UNIT_DIVISOR=1000
// MIN_ALLOCATION_UNITS=1
// MIN_PAYOUT_UNITS=1000
