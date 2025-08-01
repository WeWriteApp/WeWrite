/**
 * Currency formatting utilities for USD-based system
 */

/**
 * Format USD amount from cents to display format ($X.XX)
 * @param cents - Amount in cents (e.g., 1000 = $10.00)
 * @param currency - Currency code (default: 'USD')
 * @returns Formatted currency string (e.g., "$10.00")
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format USD cents to display format ($X.XX)
 * @param cents - Amount in cents (e.g., 1000 = $10.00)
 * @param currency - Currency code (default: 'USD')
 * @returns Formatted currency string (e.g., "$10.00")
 */
export function formatUsdCents(cents: number, currency: string = 'USD'): string {
  const dollars = cents / 100;
  return formatCurrency(dollars, currency);
}

/**
 * Format USD cents with optional subtext for payment processing
 * @param cents - Amount in cents
 * @param showSubtext - Whether to include payment processing subtext
 * @returns Object with formatted amount and optional subtext
 */
export function formatUsdCentsWithSubtext(cents: number, showSubtext: boolean = false): {
  amount: string;
  subtext?: string;
} {
  const amount = formatUsdCents(cents);
  const subtext = showSubtext
    ? "Payments processed in USD via Stripe. Local currency may be converted at checkout."
    : undefined;

  return { amount, subtext };
}

/**
 * Convert dollars to cents (for storage)
 * @param dollars - Dollar amount (e.g., 10.50)
 * @returns Amount in cents (e.g., 1050)
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert cents to dollars (for calculations)
 * @param cents - Amount in cents (e.g., 1050)
 * @returns Dollar amount (e.g., 10.50)
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Parse dollar input string to cents
 * @param input - Dollar input string (e.g., "10.50", "$10.50", "10")
 * @returns Amount in cents, or null if invalid
 */
export function parseDollarInputToCents(input: string): number | null {
  // Remove currency symbols and whitespace
  const cleaned = input.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);

  if (isNaN(parsed) || parsed < 0) {
    return null;
  }

  return dollarsToCents(parsed);
}

/**
 * Validate USD cents amount
 * @param cents - Amount in cents
 * @returns True if valid (non-negative integer)
 */
export function isValidUsdCents(cents: number): boolean {
  return Number.isInteger(cents) && cents >= 0;
}

// Legacy token functions - DEPRECATED, will be removed after migration
/**
 * @deprecated Use formatUsdCents instead
 */
export function formatTokens(tokens: number): string {
  return `${tokens.toLocaleString()} token${tokens !== 1 ? 's' : ''}`;
}

/**
 * @deprecated Use centsToDollars instead - tokens are being replaced with USD cents
 */
export function tokensToUsd(tokens: number): number {
  return tokens / 10; // $1 = 10 tokens
}

/**
 * @deprecated Use dollarsToCents instead - tokens are being replaced with USD cents
 */
export function usdToTokens(usd: number): number {
  return Math.floor(usd * 10); // Convert USD to tokens
}

/**
 * Migration helper: Convert existing token amounts to USD cents
 * @param tokens - Token amount (e.g., 100 tokens)
 * @returns USD cents (e.g., 1000 cents = $10.00)
 */
export function migrateTokensToUsdCents(tokens: number): number {
  const usdAmount = tokensToUsd(tokens); // 100 tokens → $10.00
  return dollarsToCents(usdAmount); // $10.00 → 1000 cents
}