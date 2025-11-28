import { PayoutService } from './payoutServiceUnified';

/**
 * Compatibility wrapper so legacy imports keep working.
 * Provides minimal methods expected by existing routes/services.
 */
export const stripePayoutService = {
  async verifyStripeAccount(stripeAccountId: string) {
    // Minimal readiness response; extend with real Stripe checks if needed.
    return {
      accountId: stripeAccountId,
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      status: 'ready'
    };
  },

  async getInternationalPayoutInfo(country: string) {
    // Basic placeholder info
    return {
      country,
      minPayoutCents: 2500,
      currency: 'usd'
    };
  },

  async processPayout(payoutId: string) {
    return PayoutService.processPayout(payoutId);
  }
};

export class StripePayoutService {
  static getInstance() {
    return stripePayoutService;
  }

  async processPayout(payoutId: string) {
    return stripePayoutService.processPayout(payoutId);
  }
}
