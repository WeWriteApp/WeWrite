/**
 * Tax Reporting Service
 * 
 * Comprehensive tax reporting system for 1099 forms, international tax compliance,
 * and automated tax document generation for writers and platform operations.
 */

import { db } from '../firebase/config';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';
import { TransactionTrackingService } from './transactionTrackingService';
import {
  FinancialOperationResult,
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  FinancialLogger,
  CorrelationId
} from '../types/financial';

const stripe = new Stripe(getStripeSecretKey());

/**
 * Tax document types
 */
export enum TaxDocumentType {
  FORM_1099_NEC = '1099-NEC',
  FORM_1099_K = '1099-K',
  FORM_1042_S = '1042-S',
  TAX_SUMMARY = 'TAX_SUMMARY',
  WITHHOLDING_STATEMENT = 'WITHHOLDING_STATEMENT'
}

/**
 * Tax jurisdiction information
 */
export interface TaxJurisdiction {
  country: string;
  state?: string;
  taxId?: string;
  withholdingRate: number;
  treatyBenefits: boolean;
  requiresReporting: boolean;
  reportingThreshold: number;
  documentTypes: TaxDocumentType[];
}

/**
 * Tax information for a user
 */
export interface UserTaxInfo {
  userId: string;
  taxId?: string; // SSN, EIN, or foreign tax ID
  taxIdType: 'ssn' | 'ein' | 'itin' | 'foreign';
  country: string;
  state?: string;
  isUSPerson: boolean;
  isBusiness: boolean;
  businessName?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  w9Submitted: boolean;
  w8Submitted: boolean;
  treatyBenefits: boolean;
  withholdingExempt: boolean;
  createdAt: Date;
  updatedAt: Date;
  verifiedAt?: Date;
}

/**
 * Annual tax summary for a user
 */
export interface AnnualTaxSummary {
  userId: string;
  taxYear: number;
  totalEarnings: number;
  totalWithholding: number;
  totalFees: number;
  netEarnings: number;
  currency: string;
  
  // Breakdown by source
  earningsBySource: {
    tokenAllocations: number;
    subscriptions: number;
    bonuses: number;
    other: number;
  };
  
  // Tax documents generated
  documentsGenerated: {
    type: TaxDocumentType;
    documentId: string;
    generatedAt: Date;
    amount: number;
  }[];
  
  // Quarterly breakdown
  quarterlyBreakdown: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
  };
  
  // Compliance status
  requiresReporting: boolean;
  reportingThreshold: number;
  exceedsThreshold: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tax document record
 */
export interface TaxDocument {
  id: string;
  userId: string;
  type: TaxDocumentType;
  taxYear: number;
  amount: number;
  withholdingAmount: number;
  currency: string;
  
  // Document details
  documentUrl?: string;
  documentHash: string;
  generatedAt: Date;
  sentAt?: Date;
  
  // Compliance tracking
  isRequired: boolean;
  deadlineDate: Date;
  submittedToIRS: boolean;
  submittedAt?: Date;
  
  // Metadata
  metadata: Record<string, any>;
  correlationId: CorrelationId;
}

/**
 * Tax reporting configuration
 */
export interface TaxReportingConfig {
  enabled: boolean;
  reportingThresholds: {
    domestic1099: number;      // $600 for US persons
    foreign1042: number;       // $0 for foreign persons
    form1099K: number;         // $20,000 and 200 transactions
  };
  withholdingRates: {
    defaultForeign: number;    // 30% default
    treatyReduced: number;     // Varies by treaty
    backup: number;            // 24% backup withholding
  };
  deadlines: {
    form1099: string;          // January 31
    form1042: string;          // March 15
    quarterlyReports: string;  // Quarterly deadlines
  };
  automatedGeneration: boolean;
  automatedSubmission: boolean;
}

const DEFAULT_TAX_CONFIG: TaxReportingConfig = {
  enabled: true,
  reportingThresholds: {
    domestic1099: 600,
    foreign1042: 0,
    form1099K: 20000
  },
  withholdingRates: {
    defaultForeign: 30,
    treatyReduced: 15,
    backup: 24
  },
  deadlines: {
    form1099: '01-31',
    form1042: '03-15',
    quarterlyReports: 'quarterly'
  },
  automatedGeneration: true,
  automatedSubmission: false
};

export class TaxReportingService {
  private static instance: TaxReportingService;
  private config: TaxReportingConfig;

  private constructor(config: Partial<TaxReportingConfig> = {}) {
    this.config = { ...DEFAULT_TAX_CONFIG, ...config };
  }

  static getInstance(config?: Partial<TaxReportingConfig>): TaxReportingService {
    if (!TaxReportingService.instance) {
      TaxReportingService.instance = new TaxReportingService(config);
    }
    return TaxReportingService.instance;
  }

  /**
   * Generate annual tax summary for a user
   */
  async generateAnnualTaxSummary(
    userId: string,
    taxYear: number,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<AnnualTaxSummary>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      FinancialLogger.logOperation('TAX_SUMMARY_GENERATION_START', {
        correlationId: corrId,
        userId,
        taxYear
      });

      // Get user tax information
      const userTaxInfo = await this.getUserTaxInfo(userId);
      if (!userTaxInfo) {
        return {
          success: false,
          error: FinancialUtils.createError(FinancialErrorCode.NOT_FOUND, 'User tax information not found', corrId, false, {  userId  }),
          correlationId: corrId
        };
      }

      // Calculate date range for tax year
      const startDate = new Date(taxYear, 0, 1); // January 1
      const endDate = new Date(taxYear, 11, 31, 23, 59, 59); // December 31

      // Get all earnings for the tax year
      const earnings = await this.getEarningsForPeriod(userId, startDate, endDate, corrId);
      
      // Calculate totals
      const totalEarnings = earnings.reduce((sum, earning) => sum + earning.amount, 0);
      const totalWithholding = earnings.reduce((sum, earning) => sum + (earning.withholdingAmount || 0), 0);
      const totalFees = earnings.reduce((sum, earning) => sum + (earning.feeAmount || 0), 0);
      const netEarnings = totalEarnings - totalWithholding - totalFees;

      // Breakdown by source
      const earningsBySource = earnings.reduce((acc, earning) => {
        const source = this.categorizeEarningSource(earning);
        acc[source] = (acc[source] || 0) + earning.amount;
        return acc;
      }, {
        tokenAllocations: 0,
        subscriptions: 0,
        bonuses: 0,
        other: 0
      });

      // Calculate quarterly breakdown
      const quarterlyBreakdown = this.calculateQuarterlyBreakdown(earnings, taxYear);

      // Determine reporting requirements
      const jurisdiction = this.getTaxJurisdiction(userTaxInfo);
      const requiresReporting = totalEarnings >= jurisdiction.reportingThreshold;
      const exceedsThreshold = totalEarnings >= jurisdiction.reportingThreshold;

      // Get existing tax documents
      const documentsGenerated = await this.getTaxDocuments(userId, taxYear);

      const taxSummary: AnnualTaxSummary = {
        userId,
        taxYear,
        totalEarnings,
        totalWithholding,
        totalFees,
        netEarnings,
        currency: 'usd',
        earningsBySource,
        documentsGenerated: documentsGenerated.map(doc => ({
          type: doc.type,
          documentId: doc.id,
          generatedAt: doc.generatedAt,
          amount: doc.amount
        })),
        quarterlyBreakdown,
        requiresReporting,
        reportingThreshold: jurisdiction.reportingThreshold,
        exceedsThreshold,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store tax summary
      await setDoc(doc(db, 'taxSummaries', `${userId}_${taxYear}`), {
        ...taxSummary,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      FinancialLogger.logOperation('TAX_SUMMARY_GENERATED', {
        correlationId: corrId,
        userId,
        taxYear,
        totalEarnings,
        requiresReporting,
        exceedsThreshold
      });

      return {
        success: true,
        data: taxSummary,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Failed to generate tax summary: ${error.message}`, corrId, true, {  userId, taxYear, originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Generate 1099-NEC form for a user
   */
  async generate1099NEC(
    userId: string,
    taxYear: number,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<TaxDocument>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      // Get user tax info and annual summary
      const userTaxInfo = await this.getUserTaxInfo(userId);
      const taxSummary = await this.getAnnualTaxSummary(userId, taxYear);

      if (!userTaxInfo || !taxSummary) {
        return {
          success: false,
          error: FinancialUtils.createError(FinancialErrorCode.NOT_FOUND, 'Required tax information not found', corrId, false, {  userId, taxYear  }),
          correlationId: corrId
        };
      }

      // Check if 1099-NEC is required
      if (!userTaxInfo.isUSPerson || taxSummary.totalEarnings < this.config.reportingThresholds.domestic1099) {
        return {
          success: false,
          error: FinancialUtils.createError(FinancialErrorCode.VALIDATION_ERROR, '1099-NEC not required for this user/amount', corrId, false, {  userId, taxYear, earnings: taxSummary.totalEarnings  }),
          correlationId: corrId
        };
      }

      // Generate 1099-NEC document
      const document1099 = await this.createTaxDocument({
        userId,
        type: TaxDocumentType.FORM_1099_NEC,
        taxYear,
        amount: taxSummary.totalEarnings,
        withholdingAmount: taxSummary.totalWithholding,
        currency: 'usd',
        isRequired: true,
        deadlineDate: new Date(taxYear + 1, 0, 31), // January 31 of following year
        metadata: {
          recipientInfo: {
            name: userTaxInfo.businessName || 'Individual',
            taxId: userTaxInfo.taxId,
            address: userTaxInfo.address
          },
          payerInfo: {
            name: 'WeWrite Inc.',
            ein: process.env.COMPANY_EIN,
            address: {
              line1: process.env.COMPANY_ADDRESS_LINE1,
              city: process.env.COMPANY_CITY,
              state: process.env.COMPANY_STATE,
              postalCode: process.env.COMPANY_ZIP,
              country: 'US'
            }
          },
          box1NonemployeeCompensation: taxSummary.totalEarnings,
          box4FederalIncomeTaxWithheld: taxSummary.totalWithholding
        },
        correlationId: corrId
      });

      FinancialLogger.logOperation('FORM_1099_NEC_GENERATED', {
        correlationId: corrId,
        userId,
        taxYear,
        documentId: document1099.id,
        amount: taxSummary.totalEarnings
      });

      return {
        success: true,
        data: document1099,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Failed to generate 1099-NEC: ${error.message}`, corrId, true, {  userId, taxYear, originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Generate 1042-S form for foreign users
   */
  async generate1042S(
    userId: string,
    taxYear: number,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<TaxDocument>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      const userTaxInfo = await this.getUserTaxInfo(userId);
      const taxSummary = await this.getAnnualTaxSummary(userId, taxYear);

      if (!userTaxInfo || !taxSummary) {
        return {
          success: false,
          error: FinancialUtils.createError(FinancialErrorCode.NOT_FOUND, 'Required tax information not found', corrId, false, {  userId, taxYear  }),
          correlationId: corrId
        };
      }

      // Check if 1042-S is required (for foreign persons)
      if (userTaxInfo.isUSPerson) {
        return {
          success: false,
          error: FinancialUtils.createError(FinancialErrorCode.VALIDATION_ERROR, '1042-S not required for US persons', corrId, false, {  userId, taxYear  }),
          correlationId: corrId
        };
      }

      // Calculate withholding rate
      const jurisdiction = this.getTaxJurisdiction(userTaxInfo);
      const withholdingRate = userTaxInfo.treatyBenefits ?
        this.config.withholdingRates.treatyReduced :
        this.config.withholdingRates.defaultForeign;

      const withholdingAmount = taxSummary.totalEarnings * (withholdingRate / 100);

      // Generate 1042-S document
      const document1042 = await this.createTaxDocument({
        userId,
        type: TaxDocumentType.FORM_1042_S,
        taxYear,
        amount: taxSummary.totalEarnings,
        withholdingAmount,
        currency: 'usd',
        isRequired: true,
        deadlineDate: new Date(taxYear + 1, 2, 15), // March 15 of following year
        metadata: {
          recipientInfo: {
            name: userTaxInfo.businessName || 'Individual',
            foreignTaxId: userTaxInfo.taxId,
            country: userTaxInfo.country,
            address: userTaxInfo.address
          },
          withholdingAgent: {
            name: 'WeWrite Inc.',
            ein: process.env.COMPANY_EIN,
            address: {
              line1: process.env.COMPANY_ADDRESS_LINE1,
              city: process.env.COMPANY_CITY,
              state: process.env.COMPANY_STATE,
              postalCode: process.env.COMPANY_ZIP,
              country: 'US'
            }
          },
          incomeCode: '06', // Royalties
          grossIncome: taxSummary.totalEarnings,
          federalTaxWithheld: withholdingAmount,
          withholdingRate,
          treatyBenefits: userTaxInfo.treatyBenefits
        },
        correlationId: corrId
      });

      FinancialLogger.logOperation('FORM_1042_S_GENERATED', {
        correlationId: corrId,
        userId,
        taxYear,
        documentId: document1042.id,
        amount: taxSummary.totalEarnings,
        withholdingAmount
      });

      return {
        success: true,
        data: document1042,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Failed to generate 1042-S: ${error.message}`, corrId, true, {  userId, taxYear, originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Process bulk tax document generation for all eligible users
   */
  async processBulkTaxGeneration(
    taxYear: number,
    documentType?: TaxDocumentType,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<{
    totalUsers: number;
    documentsGenerated: number;
    errors: string[];
  }>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      FinancialLogger.logOperation('BULK_TAX_GENERATION_START', {
        correlationId: corrId,
        taxYear,
        documentType
      });

      // Get all users with tax summaries for the year
      const summariesQuery = query(
        collection(db, 'taxSummaries'),
        where('taxYear', '==', taxYear),
        where('requiresReporting', '==', true)
      );

      const summariesSnapshot = await getDocs(summariesQuery);
      const totalUsers = summariesSnapshot.size;
      let documentsGenerated = 0;
      const errors: string[] = [];

      for (const summaryDoc of summariesSnapshot.docs) {
        const summary = summaryDoc.data() as AnnualTaxSummary;

        try {
          const userTaxInfo = await this.getUserTaxInfo(summary.userId);
          if (!userTaxInfo) {
            errors.push(`No tax info for user ${summary.userId}`);
            continue;
          }

          // Generate appropriate documents based on user status
          if (userTaxInfo.isUSPerson && summary.totalEarnings >= this.config.reportingThresholds.domestic1099) {
            if (!documentType || documentType === TaxDocumentType.FORM_1099_NEC) {
              const result = await this.generate1099NEC(summary.userId, taxYear, corrId);
              if (result.success) {
                documentsGenerated++;
              } else {
                errors.push(`1099-NEC failed for ${summary.userId}: ${result.error?.message}`);
              }
            }
          } else if (!userTaxInfo.isUSPerson) {
            if (!documentType || documentType === TaxDocumentType.FORM_1042_S) {
              const result = await this.generate1042S(summary.userId, taxYear, corrId);
              if (result.success) {
                documentsGenerated++;
              } else {
                errors.push(`1042-S failed for ${summary.userId}: ${result.error?.message}`);
              }
            }
          }

        } catch (error: any) {
          errors.push(`Error processing user ${summary.userId}: ${error.message}`);
        }
      }

      FinancialLogger.logOperation('BULK_TAX_GENERATION_COMPLETE', {
        correlationId: corrId,
        taxYear,
        totalUsers,
        documentsGenerated,
        errorCount: errors.length
      });

      return {
        success: true,
        data: {
          totalUsers,
          documentsGenerated,
          errors: errors.slice(0, 10) // Limit error details
        },
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Bulk tax generation failed: ${error.message}`, corrId, true, {  taxYear, originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Calculate withholding for a payment
   */
  async calculateWithholding(
    userId: string,
    amount: number,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<{
    withholdingAmount: number;
    withholdingRate: number;
    netAmount: number;
  }>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      const userTaxInfo = await this.getUserTaxInfo(userId);

      if (!userTaxInfo) {
        // Default to maximum withholding for unknown users
        const withholdingRate = this.config.withholdingRates.defaultForeign;
        const withholdingAmount = amount * (withholdingRate / 100);

        return {
          success: true,
          data: {
            withholdingAmount,
            withholdingRate,
            netAmount: amount - withholdingAmount
          },
          correlationId: corrId
        };
      }

      let withholdingRate = 0;

      if (userTaxInfo.isUSPerson) {
        // US persons - no withholding unless backup withholding applies
        if (!userTaxInfo.taxId || !userTaxInfo.w9Submitted) {
          withholdingRate = this.config.withholdingRates.backup;
        }
      } else {
        // Foreign persons - apply treaty rates or default
        if (userTaxInfo.treatyBenefits && userTaxInfo.w8Submitted) {
          withholdingRate = this.config.withholdingRates.treatyReduced;
        } else {
          withholdingRate = this.config.withholdingRates.defaultForeign;
        }
      }

      const withholdingAmount = amount * (withholdingRate / 100);
      const netAmount = amount - withholdingAmount;

      return {
        success: true,
        data: {
          withholdingAmount,
          withholdingRate,
          netAmount
        },
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Withholding calculation failed: ${error.message}`, corrId, true, {  userId, amount, originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  // Helper methods

  /**
   * Get user tax information
   */
  private async getUserTaxInfo(userId: string): Promise<UserTaxInfo | null> {
    try {
      const taxInfoDoc = await getDoc(doc(db, 'userTaxInfo', userId));
      return taxInfoDoc.exists() ? taxInfoDoc.data() as UserTaxInfo : null;
    } catch (error) {
      console.error('Error getting user tax info:', error);
      return null;
    }
  }

  /**
   * Get annual tax summary
   */
  private async getAnnualTaxSummary(userId: string, taxYear: number): Promise<AnnualTaxSummary | null> {
    try {
      const summaryDoc = await getDoc(doc(db, 'taxSummaries', `${userId}_${taxYear}`));
      return summaryDoc.exists() ? summaryDoc.data() as AnnualTaxSummary : null;
    } catch (error) {
      console.error('Error getting tax summary:', error);
      return null;
    }
  }

  /**
   * Get earnings for a specific period
   */
  private async getEarningsForPeriod(
    userId: string,
    startDate: Date,
    endDate: Date,
    correlationId: CorrelationId
  ): Promise<any[]> {
    try {
      // Get earnings from token allocations
      const earningsQuery = query(
        collection(db, 'writerTokenEarnings'),
        where('userId', '==', userId),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate)
      );

      const earningsSnapshot = await getDocs(earningsQuery);
      return earningsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        amount: doc.data().usdValue || 0,
        withholdingAmount: doc.data().withholdingAmount || 0,
        feeAmount: doc.data().feeAmount || 0
      }));

    } catch (error) {
      console.error('Error getting earnings for period:', error);
      return [];
    }
  }

  /**
   * Get existing tax documents for a user and year
   */
  private async getTaxDocuments(userId: string, taxYear: number): Promise<TaxDocument[]> {
    try {
      const documentsQuery = query(
        collection(db, 'taxDocuments'),
        where('userId', '==', userId),
        where('taxYear', '==', taxYear)
      );

      const documentsSnapshot = await getDocs(documentsQuery);
      return documentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TaxDocument));

    } catch (error) {
      console.error('Error getting tax documents:', error);
      return [];
    }
  }

  /**
   * Create a tax document record
   */
  private async createTaxDocument(
    documentData: Omit<TaxDocument, 'id' | 'documentHash' | 'generatedAt' | 'submittedToIRS'>
  ): Promise<TaxDocument> {
    const documentId = `${documentData.type}_${documentData.userId}_${documentData.taxYear}`;

    // Generate document hash for integrity
    const documentHash = this.generateDocumentHash(documentData);

    const taxDocument: TaxDocument = {
      ...documentData,
      id: documentId,
      documentHash,
      generatedAt: new Date(),
      submittedToIRS: false
    };

    await setDoc(doc(db, 'taxDocuments', documentId), {
      ...taxDocument,
      generatedAt: serverTimestamp()
    });

    return taxDocument;
  }

  /**
   * Categorize earning source for tax reporting
   */
  private categorizeEarningSource(earning: any): keyof AnnualTaxSummary['earningsBySource'] {
    if (earning.source === 'token_allocation' || earning.type === 'token_allocation') {
      return 'tokenAllocations';
    } else if (earning.source === 'subscription' || earning.type === 'subscription') {
      return 'subscriptions';
    } else if (earning.source === 'bonus' || earning.type === 'bonus') {
      return 'bonuses';
    } else {
      return 'other';
    }
  }

  /**
   * Calculate quarterly breakdown of earnings
   */
  private calculateQuarterlyBreakdown(earnings: any[], taxYear: number): AnnualTaxSummary['quarterlyBreakdown'] {
    const quarters = { q1: 0, q2: 0, q3: 0, q4: 0 };

    earnings.forEach(earning => {
      const date = earning.createdAt instanceof Date ? earning.createdAt : new Date(earning.createdAt);
      const month = date.getMonth() + 1; // 1-based month

      if (month >= 1 && month <= 3) {
        quarters.q1 += earning.amount;
      } else if (month >= 4 && month <= 6) {
        quarters.q2 += earning.amount;
      } else if (month >= 7 && month <= 9) {
        quarters.q3 += earning.amount;
      } else if (month >= 10 && month <= 12) {
        quarters.q4 += earning.amount;
      }
    });

    return quarters;
  }

  /**
   * Get tax jurisdiction information for a user
   */
  private getTaxJurisdiction(userTaxInfo: UserTaxInfo): TaxJurisdiction {
    const defaultJurisdiction: TaxJurisdiction = {
      country: userTaxInfo.country,
      state: userTaxInfo.state,
      withholdingRate: userTaxInfo.isUSPerson ? 0 : this.config.withholdingRates.defaultForeign,
      treatyBenefits: userTaxInfo.treatyBenefits,
      requiresReporting: true,
      reportingThreshold: userTaxInfo.isUSPerson ?
        this.config.reportingThresholds.domestic1099 :
        this.config.reportingThresholds.foreign1042,
      documentTypes: userTaxInfo.isUSPerson ?
        [TaxDocumentType.FORM_1099_NEC] :
        [TaxDocumentType.FORM_1042_S]
    };

    return defaultJurisdiction;
  }

  /**
   * Generate document hash for integrity verification
   */
  private generateDocumentHash(documentData: any): string {
    const dataString = JSON.stringify(documentData, Object.keys(documentData).sort());

    // Simple hash function (in production, use a proper crypto hash)
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Get tax reporting configuration
   */
  getConfig(): TaxReportingConfig {
    return { ...this.config };
  }

  /**
   * Update tax reporting configuration
   */
  updateConfig(config: Partial<TaxReportingConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
