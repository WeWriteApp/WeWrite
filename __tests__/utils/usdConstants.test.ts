/**
 * Tests for USD constants and tier utilities
 */

import {
  USD_SUBSCRIPTION_TIERS,
  getEffectiveUsdTier,
  validateCustomUsdAmount,
  getCurrentMonth,
  USD_UI_TEXT
} from '../../app/utils/usdConstants';

describe('USD_SUBSCRIPTION_TIERS', () => {
  test('has all required tier properties', () => {
    const requiredTiers = ['FREE', 'SUPPORTER', 'ADVOCATE', 'CHAMPION', 'PATRON', 'CUSTOM'];
    
    requiredTiers.forEach(tierKey => {
      expect(USD_SUBSCRIPTION_TIERS).toHaveProperty(tierKey);
      const tier = USD_SUBSCRIPTION_TIERS[tierKey as keyof typeof USD_SUBSCRIPTION_TIERS];
      
      expect(tier).toHaveProperty('id');
      expect(tier).toHaveProperty('name');
      expect(tier).toHaveProperty('usdAmount');
      expect(tier).toHaveProperty('description');
      
      if (tierKey !== 'FREE' && tierKey !== 'CUSTOM') {
        expect(typeof tier.usdAmount).toBe('number');
        expect(tier.usdAmount).toBeGreaterThan(0);
      }
    });
  });

  test('tiers are in ascending order by amount', () => {
    const tiers = [
      USD_SUBSCRIPTION_TIERS.SUPPORTER,
      USD_SUBSCRIPTION_TIERS.ADVOCATE,
      USD_SUBSCRIPTION_TIERS.CHAMPION,
      USD_SUBSCRIPTION_TIERS.PATRON
    ];

    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].usdAmount).toBeGreaterThan(tiers[i - 1].usdAmount);
    }
  });

  test('free tier has zero amount', () => {
    expect(USD_SUBSCRIPTION_TIERS.FREE.usdAmount).toBe(0);
  });

  test('custom tier has minimum amount', () => {
    expect(USD_SUBSCRIPTION_TIERS.CUSTOM.minUsdAmount).toBeGreaterThan(0);
    expect(typeof USD_SUBSCRIPTION_TIERS.CUSTOM.minUsdAmount).toBe('number');
  });
});

describe('getEffectiveUsdTier', () => {
  test('returns FREE tier for zero amount', () => {
    const tier = getEffectiveUsdTier(0);
    expect(tier.id).toBe('free');
    expect(tier.usdAmount).toBe(0);
  });

  test('returns correct tier for standard amounts', () => {
    expect(getEffectiveUsdTier(10).id).toBe('supporter');
    expect(getEffectiveUsdTier(25).id).toBe('advocate');
    expect(getEffectiveUsdTier(50).id).toBe('champion');
    expect(getEffectiveUsdTier(100).id).toBe('patron');
  });

  test('returns CUSTOM tier for amounts above standard tiers', () => {
    const customTier = getEffectiveUsdTier(150);
    expect(customTier.id).toBe('custom');
    expect(customTier.usdAmount).toBe(150);
    expect(customTier.name).toBe('Custom');
  });

  test('returns CUSTOM tier for amounts between standard tiers', () => {
    const customTier = getEffectiveUsdTier(75);
    expect(customTier.id).toBe('custom');
    expect(customTier.usdAmount).toBe(75);
  });

  test('handles edge cases', () => {
    // Just below standard tier
    expect(getEffectiveUsdTier(9.99).id).toBe('custom');
    
    // Just above standard tier
    expect(getEffectiveUsdTier(10.01).id).toBe('custom');
    
    // Very large amount
    expect(getEffectiveUsdTier(1000).id).toBe('custom');
  });

  test('negative amounts return FREE tier', () => {
    const tier = getEffectiveUsdTier(-10);
    expect(tier.id).toBe('free');
    expect(tier.usdAmount).toBe(0);
  });
});

describe('validateCustomUsdAmount', () => {
  test('validates amounts correctly', () => {
    expect(validateCustomUsdAmount(0)).toEqual({
      isValid: false,
      error: 'Amount must be greater than 0'
    });

    expect(validateCustomUsdAmount(-10)).toEqual({
      isValid: false,
      error: 'Amount must be greater than 0'
    });

    expect(validateCustomUsdAmount(5)).toEqual({
      isValid: false,
      error: `Custom amount must be at least $${USD_SUBSCRIPTION_TIERS.CUSTOM.minUsdAmount}`
    });

    expect(validateCustomUsdAmount(150)).toEqual({
      isValid: true,
      error: null
    });
  });

  test('handles minimum custom amount boundary', () => {
    const minAmount = USD_SUBSCRIPTION_TIERS.CUSTOM.minUsdAmount;
    
    expect(validateCustomUsdAmount(minAmount - 0.01)).toEqual({
      isValid: false,
      error: `Custom amount must be at least $${minAmount}`
    });

    expect(validateCustomUsdAmount(minAmount)).toEqual({
      isValid: true,
      error: null
    });

    expect(validateCustomUsdAmount(minAmount + 0.01)).toEqual({
      isValid: true,
      error: null
    });
  });

  test('handles very large amounts', () => {
    expect(validateCustomUsdAmount(10000)).toEqual({
      isValid: true,
      error: null
    });
  });
});

describe('getCurrentMonth', () => {
  test('returns current month in YYYY-MM format', () => {
    const currentMonth = getCurrentMonth();
    expect(currentMonth).toMatch(/^\d{4}-\d{2}$/);
    
    const [year, month] = currentMonth.split('-');
    expect(parseInt(year)).toBeGreaterThanOrEqual(2024);
    expect(parseInt(month)).toBeGreaterThanOrEqual(1);
    expect(parseInt(month)).toBeLessThanOrEqual(12);
  });

  test('returns consistent format', () => {
    const month1 = getCurrentMonth();
    const month2 = getCurrentMonth();
    expect(month1).toBe(month2);
  });
});

describe('USD_UI_TEXT', () => {
  test('has all required UI text properties', () => {
    const requiredProperties = [
      'FUND_ACCOUNT',
      'NO_BALANCE_MESSAGE',
      'OUT_OF_FUNDS',
      'TOOLTIP_TEXT'
    ];

    requiredProperties.forEach(prop => {
      expect(USD_UI_TEXT).toHaveProperty(prop);
      expect(typeof USD_UI_TEXT[prop as keyof typeof USD_UI_TEXT]).toBe('string');
      expect(USD_UI_TEXT[prop as keyof typeof USD_UI_TEXT].length).toBeGreaterThan(0);
    });
  });

  test('UI text is user-friendly', () => {
    // Check that UI text doesn't contain technical jargon
    expect(USD_UI_TEXT.NO_BALANCE_MESSAGE).not.toContain('API');
    expect(USD_UI_TEXT.NO_BALANCE_MESSAGE).not.toContain('database');
    expect(USD_UI_TEXT.NO_BALANCE_MESSAGE).not.toContain('error');
    
    // Check that tooltip text is informative
    expect(USD_UI_TEXT.TOOLTIP_TEXT.length).toBeGreaterThan(20);
    expect(USD_UI_TEXT.TOOLTIP_TEXT).toContain('USD');
  });
});

describe('Integration tests', () => {
  test('tier system covers all common subscription amounts', () => {
    const commonAmounts = [5, 10, 15, 20, 25, 30, 50, 75, 100, 150, 200];
    
    commonAmounts.forEach(amount => {
      const tier = getEffectiveUsdTier(amount);
      expect(tier).toBeDefined();
      expect(tier.id).toBeDefined();
      expect(tier.name).toBeDefined();
      expect(tier.usdAmount).toBeDefined();
    });
  });

  test('validation works with tier system', () => {
    // Standard tier amounts should be valid
    expect(validateCustomUsdAmount(USD_SUBSCRIPTION_TIERS.SUPPORTER.usdAmount).isValid).toBe(true);
    expect(validateCustomUsdAmount(USD_SUBSCRIPTION_TIERS.ADVOCATE.usdAmount).isValid).toBe(true);
    expect(validateCustomUsdAmount(USD_SUBSCRIPTION_TIERS.CHAMPION.usdAmount).isValid).toBe(true);
    expect(validateCustomUsdAmount(USD_SUBSCRIPTION_TIERS.PATRON.usdAmount).isValid).toBe(true);
    
    // Custom amounts above minimum should be valid
    expect(validateCustomUsdAmount(USD_SUBSCRIPTION_TIERS.CUSTOM.minUsdAmount).isValid).toBe(true);
  });

  test('month format is consistent with database expectations', () => {
    const currentMonth = getCurrentMonth();
    
    // Should be parseable as a date
    const dateString = `${currentMonth}-01`;
    const date = new Date(dateString);
    expect(date.getFullYear()).toBeGreaterThanOrEqual(2024);
    expect(date.getMonth()).toBeGreaterThanOrEqual(0);
    expect(date.getMonth()).toBeLessThanOrEqual(11);
  });
});
