/**
 * Tests for USD currency formatting and conversion utilities
 */

import {
  formatUsdCents,
  dollarsToCents,
  centsToDollars,
  parseDollarInputToCents,
  migrateTokensToUsdCents,
  formatCurrency
} from '../../app/utils/formatCurrency';

describe('formatUsdCents', () => {
  test('formats cents to USD string correctly', () => {
    expect(formatUsdCents(0)).toBe('$0.00');
    expect(formatUsdCents(100)).toBe('$1.00');
    expect(formatUsdCents(1050)).toBe('$10.50');
    expect(formatUsdCents(999)).toBe('$9.99');
    expect(formatUsdCents(10000)).toBe('$100.00');
  });

  test('handles negative values', () => {
    expect(formatUsdCents(-100)).toBe('-$1.00');
    expect(formatUsdCents(-1050)).toBe('-$10.50');
  });

  test('handles large values', () => {
    expect(formatUsdCents(100000)).toBe('$1,000.00');
    expect(formatUsdCents(1000000)).toBe('$10,000.00');
  });
});

describe('dollarsToCents', () => {
  test('converts dollars to cents correctly', () => {
    expect(dollarsToCents(0)).toBe(0);
    expect(dollarsToCents(1)).toBe(100);
    expect(dollarsToCents(10.50)).toBe(1050);
    expect(dollarsToCents(9.99)).toBe(999);
    expect(dollarsToCents(100)).toBe(10000);
  });

  test('handles decimal precision correctly', () => {
    expect(dollarsToCents(1.234)).toBe(123); // Rounds down
    expect(dollarsToCents(1.235)).toBe(124); // Rounds up
    expect(dollarsToCents(1.999)).toBe(200); // Rounds up
  });

  test('handles negative values', () => {
    expect(dollarsToCents(-1)).toBe(-100);
    expect(dollarsToCents(-10.50)).toBe(-1050);
  });
});

describe('centsToDollars', () => {
  test('converts cents to dollars correctly', () => {
    expect(centsToDollars(0)).toBe(0);
    expect(centsToDollars(100)).toBe(1);
    expect(centsToDollars(1050)).toBe(10.5);
    expect(centsToDollars(999)).toBe(9.99);
    expect(centsToDollars(10000)).toBe(100);
  });

  test('handles negative values', () => {
    expect(centsToDollars(-100)).toBe(-1);
    expect(centsToDollars(-1050)).toBe(-10.5);
  });
});

describe('parseDollarInputToCents', () => {
  test('parses valid dollar inputs', () => {
    expect(parseDollarInputToCents('0')).toBe(0);
    expect(parseDollarInputToCents('1')).toBe(100);
    expect(parseDollarInputToCents('1.00')).toBe(100);
    expect(parseDollarInputToCents('10.50')).toBe(1050);
    expect(parseDollarInputToCents('9.99')).toBe(999);
    expect(parseDollarInputToCents('100')).toBe(10000);
  });

  test('handles dollar sign prefix', () => {
    expect(parseDollarInputToCents('$1')).toBe(100);
    expect(parseDollarInputToCents('$10.50')).toBe(1050);
    expect(parseDollarInputToCents('$100.00')).toBe(10000);
  });

  test('handles whitespace', () => {
    expect(parseDollarInputToCents(' 1.00 ')).toBe(100);
    expect(parseDollarInputToCents(' $10.50 ')).toBe(1050);
  });

  test('returns null for invalid inputs', () => {
    expect(parseDollarInputToCents('')).toBe(null);
    expect(parseDollarInputToCents('abc')).toBe(null);
    expect(parseDollarInputToCents('$abc')).toBe(null);
    expect(parseDollarInputToCents('1.2.3')).toBe(null);
    expect(parseDollarInputToCents('$')).toBe(null);
  });

  test('handles edge cases', () => {
    expect(parseDollarInputToCents('0.00')).toBe(0);
    expect(parseDollarInputToCents('0.01')).toBe(1);
    expect(parseDollarInputToCents('0.1')).toBe(10);
    expect(parseDollarInputToCents('.50')).toBe(50);
  });
});

describe('migrateTokensToUsdCents', () => {
  test('converts tokens to USD cents using 10:1 ratio', () => {
    expect(migrateTokensToUsdCents(0)).toBe(0);
    expect(migrateTokensToUsdCents(10)).toBe(100); // 10 tokens = $1.00
    expect(migrateTokensToUsdCents(100)).toBe(1000); // 100 tokens = $10.00
    expect(migrateTokensToUsdCents(250)).toBe(2500); // 250 tokens = $25.00
    expect(migrateTokensToUsdCents(500)).toBe(5000); // 500 tokens = $50.00
  });

  test('handles fractional tokens', () => {
    expect(migrateTokensToUsdCents(15)).toBe(150); // 15 tokens = $1.50
    expect(migrateTokensToUsdCents(1)).toBe(10); // 1 token = $0.10
    expect(migrateTokensToUsdCents(5)).toBe(50); // 5 tokens = $0.50
  });

  test('handles negative values', () => {
    expect(migrateTokensToUsdCents(-10)).toBe(-100);
    expect(migrateTokensToUsdCents(-100)).toBe(-1000);
  });
});

describe('formatCurrency (legacy)', () => {
  test('formats currency correctly', () => {
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(1)).toBe('$1.00');
    expect(formatCurrency(10.50)).toBe('$10.50');
    expect(formatCurrency(100)).toBe('$100.00');
  });

  test('handles negative values', () => {
    expect(formatCurrency(-1)).toBe('-$1.00');
    expect(formatCurrency(-10.50)).toBe('-$10.50');
  });
});

describe('Round-trip conversions', () => {
  test('dollars -> cents -> dollars maintains precision', () => {
    const testValues = [0, 1, 10.50, 9.99, 100, 1000];
    
    testValues.forEach(dollars => {
      const cents = dollarsToCents(dollars);
      const backToDollars = centsToDollars(cents);
      expect(backToDollars).toBe(dollars);
    });
  });

  test('cents -> dollars -> cents maintains precision', () => {
    const testValues = [0, 100, 1050, 999, 10000, 100000];
    
    testValues.forEach(cents => {
      const dollars = centsToDollars(cents);
      const backToCents = dollarsToCents(dollars);
      expect(backToCents).toBe(cents);
    });
  });
});

describe('Edge cases and error handling', () => {
  test('handles very large numbers', () => {
    const largeDollars = 999999.99;
    const largeCents = dollarsToCents(largeDollars);
    expect(largeCents).toBe(99999999);
    expect(centsToDollars(largeCents)).toBe(largeDollars);
  });

  test('handles very small numbers', () => {
    expect(dollarsToCents(0.01)).toBe(1);
    expect(centsToDollars(1)).toBe(0.01);
  });

  test('handles zero values consistently', () => {
    expect(formatUsdCents(0)).toBe('$0.00');
    expect(dollarsToCents(0)).toBe(0);
    expect(centsToDollars(0)).toBe(0);
    expect(parseDollarInputToCents('0')).toBe(0);
    expect(migrateTokensToUsdCents(0)).toBe(0);
  });
});
