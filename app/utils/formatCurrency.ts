/**
 * Currency formatting utilities
 */

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatTokens(tokens: number): string {
  return `${tokens.toLocaleString()} token${tokens !== 1 ? 's' : ''}`;
}

export function tokensToUsd(tokens: number): number {
  return tokens / 10; // $1 = 10 tokens
}

export function usdToTokens(usd: number): number {
  return Math.floor(usd * 10); // Convert USD to tokens
}
