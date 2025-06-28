/**
 * Tax Information Service
 * 
 * Handles collection, validation, and management of user tax information
 * including W-9, W-8 forms, and international tax compliance.
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
  getDocs,
  serverTimestamp
} from 'firebase/firestore';

import {
  FinancialOperationResult,
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  FinancialLogger,
  CorrelationId
} from '../types/financial';

import type { UserTaxInfo } from './taxReportingService';

/**
 * W-9 form data structure
 */
export interface W9FormData {
  name: string;
  businessName?: string;
  taxClassification: 'individual' | 'sole_proprietor' | 'c_corp' | 's_corp' | 'partnership' | 'llc' | 'other';
  otherClassification?: string;
  payeeName?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
  taxIdNumber: string;
  taxIdType: 'ssn' | 'ein';
  backupWithholdingExempt: boolean;
  fatcaExempt: boolean;
  signature: string;
  signatureDate: Date;
}

/**
 * W-8 form data structure (simplified)
 */
export interface W8FormData {
  formType: 'W8BEN' | 'W8BEN-E' | 'W8ECI' | 'W8EXP' | 'W8IMY';
  name: string;
  countryOfCitizenship: string;
  permanentAddress: {
    line1: string;
    line2?: string;
    city: string;
    country: string;
    postalCode?: string;
  };
  mailingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    country: string;
    postalCode?: string;
  };
  foreignTaxId?: string;
  referenceNumber?: string;
  dateOfBirth?: Date;
  treatyClaims: {
    claimsTreatyBenefits: boolean;
    treatyCountry?: string;
    treatyArticle?: string;
    withholdingRate?: number;
    typeOfIncome?: string;
    reasonForBenefits?: string;
  };
  signature: string;
  signatureDate: Date;
}

/**
 * Tax form submission record
 */
export interface TaxFormSubmission {
  id: string;
  userId: string;
  formType: 'W9' | 'W8BEN' | 'W8BEN-E' | 'W8ECI' | 'W8EXP' | 'W8IMY';
  formData: W9FormData | W8FormData;
  submittedAt: Date;
  ipAddress: string;
  userAgent: string;
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;
  documentUrl?: string;
  correlationId: CorrelationId;
}

/**
 * Tax validation result
 */
export interface TaxValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredForms: string[];
  complianceStatus: 'compliant' | 'pending' | 'non_compliant';
}

export class TaxInformationService {
  private static instance: TaxInformationService;

  private constructor() {}

  static getInstance(): TaxInformationService {
    if (!TaxInformationService.instance) {
      TaxInformationService.instance = new TaxInformationService();
    }
    return TaxInformationService.instance;
  }

  /**
   * Submit W-9 form for US persons
   */
  async submitW9Form(
    userId: string,
    formData: W9FormData,
    ipAddress: string,
    userAgent: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<TaxFormSubmission>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      FinancialLogger.logOperation('W9_FORM_SUBMISSION_START', {
        correlationId: corrId,
        userId,
        taxIdType: formData.taxIdType
      });

      // Validate W-9 form data
      const validation = this.validateW9Form(formData);
      if (!validation.isValid) {
        return {
          success: false,
          error: new FinancialError(
            FinancialErrorCode.VALIDATION_ERROR,
            `W-9 form validation failed: ${validation.errors.join(', ')}`,
            false,
            { correlationId: corrId, userId, errors: validation.errors }
          ),
          correlationId: corrId
        };
      }

      // Create form submission record
      const submissionId = `w9_${userId}_${Date.now()}`;
      const submission: TaxFormSubmission = {
        id: submissionId,
        userId,
        formType: 'W9',
        formData,
        submittedAt: new Date(),
        ipAddress,
        userAgent,
        verified: false,
        correlationId: corrId
      };

      // Store form submission
      await setDoc(doc(db, 'taxFormSubmissions', submissionId), {
        ...submission,
        submittedAt: serverTimestamp()
      });

      // Update or create user tax info
      const userTaxInfo: UserTaxInfo = {
        userId,
        taxId: formData.taxIdNumber,
        taxIdType: formData.taxIdType,
        country: 'US',
        state: formData.address.state,
        isUSPerson: true,
        isBusiness: formData.taxClassification !== 'individual',
        businessName: formData.businessName,
        address: {
          line1: formData.address.line1,
          line2: formData.address.line2,
          city: formData.address.city,
          state: formData.address.state,
          postalCode: formData.address.postalCode,
          country: 'US'
        },
        w9Submitted: true,
        w8Submitted: false,
        treatyBenefits: false,
        withholdingExempt: formData.backupWithholdingExempt,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'userTaxInfo', userId), {
        ...userTaxInfo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      FinancialLogger.logOperation('W9_FORM_SUBMITTED', {
        correlationId: corrId,
        userId,
        submissionId,
        taxIdType: formData.taxIdType
      });

      return {
        success: true,
        data: submission,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = new FinancialError(
        FinancialErrorCode.PROCESSING_ERROR,
        `W-9 form submission failed: ${error.message}`,
        true,
        { correlationId: corrId, userId, originalError: error }
      );

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Submit W-8 form for foreign persons
   */
  async submitW8Form(
    userId: string,
    formData: W8FormData,
    ipAddress: string,
    userAgent: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<TaxFormSubmission>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      FinancialLogger.logOperation('W8_FORM_SUBMISSION_START', {
        correlationId: corrId,
        userId,
        formType: formData.formType,
        country: formData.countryOfCitizenship
      });

      // Validate W-8 form data
      const validation = this.validateW8Form(formData);
      if (!validation.isValid) {
        return {
          success: false,
          error: new FinancialError(
            FinancialErrorCode.VALIDATION_ERROR,
            `W-8 form validation failed: ${validation.errors.join(', ')}`,
            false,
            { correlationId: corrId, userId, errors: validation.errors }
          ),
          correlationId: corrId
        };
      }

      // Create form submission record
      const submissionId = `w8_${userId}_${Date.now()}`;
      const submission: TaxFormSubmission = {
        id: submissionId,
        userId,
        formType: formData.formType,
        formData,
        submittedAt: new Date(),
        ipAddress,
        userAgent,
        verified: false,
        correlationId: corrId
      };

      // Store form submission
      await setDoc(doc(db, 'taxFormSubmissions', submissionId), {
        ...submission,
        submittedAt: serverTimestamp()
      });

      // Update or create user tax info
      const userTaxInfo: UserTaxInfo = {
        userId,
        taxId: formData.foreignTaxId,
        taxIdType: 'foreign',
        country: formData.countryOfCitizenship,
        isUSPerson: false,
        isBusiness: formData.formType === 'W8BEN-E',
        businessName: formData.formType === 'W8BEN-E' ? formData.name : undefined,
        address: {
          line1: formData.permanentAddress.line1,
          line2: formData.permanentAddress.line2,
          city: formData.permanentAddress.city,
          postalCode: formData.permanentAddress.postalCode || '',
          country: formData.permanentAddress.country
        },
        w9Submitted: false,
        w8Submitted: true,
        treatyBenefits: formData.treatyClaims.claimsTreatyBenefits,
        withholdingExempt: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'userTaxInfo', userId), {
        ...userTaxInfo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      FinancialLogger.logOperation('W8_FORM_SUBMITTED', {
        correlationId: corrId,
        userId,
        submissionId,
        formType: formData.formType,
        treatyBenefits: formData.treatyClaims.claimsTreatyBenefits
      });

      return {
        success: true,
        data: submission,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = new FinancialError(
        FinancialErrorCode.PROCESSING_ERROR,
        `W-8 form submission failed: ${error.message}`,
        true,
        { correlationId: corrId, userId, originalError: error }
      );

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Validate user tax compliance status
   */
  async validateTaxCompliance(
    userId: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<TaxValidationResult>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      const userTaxInfo = await this.getUserTaxInfo(userId);
      const errors: string[] = [];
      const warnings: string[] = [];
      const requiredForms: string[] = [];

      if (!userTaxInfo) {
        errors.push('No tax information on file');
        requiredForms.push('Tax information collection required');

        return {
          success: true,
          data: {
            isValid: false,
            errors,
            warnings,
            requiredForms,
            complianceStatus: 'non_compliant'
          },
          correlationId: corrId
        };
      }

      // Validate based on user type
      if (userTaxInfo.isUSPerson) {
        if (!userTaxInfo.w9Submitted) {
          errors.push('W-9 form required for US persons');
          requiredForms.push('W-9');
        }

        if (!userTaxInfo.taxId) {
          errors.push('Tax ID (SSN/EIN) required');
        } else if (!this.validateTaxId(userTaxInfo.taxId, userTaxInfo.taxIdType)) {
          errors.push('Invalid tax ID format');
        }
      } else {
        if (!userTaxInfo.w8Submitted) {
          errors.push('W-8 form required for foreign persons');
          requiredForms.push('W-8BEN or W-8BEN-E');
        }

        if (!userTaxInfo.country || userTaxInfo.country === 'US') {
          errors.push('Valid foreign country required');
        }
      }

      // Address validation
      if (!userTaxInfo.address || !userTaxInfo.address.line1 || !userTaxInfo.address.city) {
        errors.push('Complete address required');
      }

      // Determine compliance status
      let complianceStatus: TaxValidationResult['complianceStatus'] = 'compliant';
      if (errors.length > 0) {
        complianceStatus = 'non_compliant';
      } else if (warnings.length > 0) {
        complianceStatus = 'pending';
      }

      const result: TaxValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        requiredForms,
        complianceStatus
      };

      FinancialLogger.logOperation('TAX_COMPLIANCE_VALIDATED', {
        correlationId: corrId,
        userId,
        isValid: result.isValid,
        complianceStatus: result.complianceStatus,
        errorCount: errors.length
      });

      return {
        success: true,
        data: result,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = new FinancialError(
        FinancialErrorCode.PROCESSING_ERROR,
        `Tax compliance validation failed: ${error.message}`,
        true,
        { correlationId: corrId, userId, originalError: error }
      );

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Get user tax information
   */
  async getUserTaxInfo(userId: string): Promise<UserTaxInfo | null> {
    try {
      const taxInfoDoc = await getDoc(doc(db, 'userTaxInfo', userId));
      return taxInfoDoc.exists() ? taxInfoDoc.data() as UserTaxInfo : null;
    } catch (error) {
      console.error('Error getting user tax info:', error);
      return null;
    }
  }

  /**
   * Get tax form submissions for a user
   */
  async getTaxFormSubmissions(userId: string): Promise<TaxFormSubmission[]> {
    try {
      const submissionsQuery = query(
        collection(db, 'taxFormSubmissions'),
        where('userId', '==', userId)
      );

      const submissionsSnapshot = await getDocs(submissionsQuery);
      return submissionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TaxFormSubmission));

    } catch (error) {
      console.error('Error getting tax form submissions:', error);
      return [];
    }
  }

  // Validation methods

  /**
   * Validate W-9 form data
   */
  private validateW9Form(formData: W9FormData): TaxValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!formData.name?.trim()) {
      errors.push('Name is required');
    }

    if (!formData.taxIdNumber?.trim()) {
      errors.push('Tax ID number is required');
    } else if (!this.validateTaxId(formData.taxIdNumber, formData.taxIdType)) {
      errors.push('Invalid tax ID format');
    }

    // Address validation
    if (!formData.address?.line1?.trim()) {
      errors.push('Address line 1 is required');
    }
    if (!formData.address?.city?.trim()) {
      errors.push('City is required');
    }
    if (!formData.address?.state?.trim()) {
      errors.push('State is required');
    }
    if (!formData.address?.postalCode?.trim()) {
      errors.push('Postal code is required');
    }

    // Signature validation
    if (!formData.signature?.trim()) {
      errors.push('Electronic signature is required');
    }
    if (!formData.signatureDate) {
      errors.push('Signature date is required');
    }

    // Business name validation
    if (formData.taxClassification !== 'individual' && !formData.businessName?.trim()) {
      warnings.push('Business name recommended for business entities');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiredForms: [],
      complianceStatus: errors.length === 0 ? 'compliant' : 'non_compliant'
    };
  }

  /**
   * Validate W-8 form data
   */
  private validateW8Form(formData: W8FormData): TaxValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!formData.name?.trim()) {
      errors.push('Name is required');
    }

    if (!formData.countryOfCitizenship?.trim()) {
      errors.push('Country of citizenship is required');
    } else if (formData.countryOfCitizenship === 'US') {
      errors.push('US persons should use W-9 form');
    }

    // Address validation
    if (!formData.permanentAddress?.line1?.trim()) {
      errors.push('Permanent address line 1 is required');
    }
    if (!formData.permanentAddress?.city?.trim()) {
      errors.push('Permanent address city is required');
    }
    if (!formData.permanentAddress?.country?.trim()) {
      errors.push('Permanent address country is required');
    }

    // Signature validation
    if (!formData.signature?.trim()) {
      errors.push('Electronic signature is required');
    }
    if (!formData.signatureDate) {
      errors.push('Signature date is required');
    }

    // Treaty benefits validation
    if (formData.treatyClaims.claimsTreatyBenefits) {
      if (!formData.treatyClaims.treatyCountry?.trim()) {
        errors.push('Treaty country is required when claiming treaty benefits');
      }
      if (!formData.treatyClaims.treatyArticle?.trim()) {
        warnings.push('Treaty article recommended when claiming treaty benefits');
      }
    }

    // Foreign tax ID validation
    if (!formData.foreignTaxId?.trim()) {
      warnings.push('Foreign tax ID recommended for tax reporting');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiredForms: [],
      complianceStatus: errors.length === 0 ? 'compliant' : 'non_compliant'
    };
  }

  /**
   * Validate tax ID format
   */
  private validateTaxId(taxId: string, type: 'ssn' | 'ein' | 'itin' | 'foreign'): boolean {
    if (!taxId) return false;

    const cleanId = taxId.replace(/[-\s]/g, '');

    switch (type) {
      case 'ssn':
        // SSN format: 9 digits, not all zeros, not starting with 9
        return /^\d{9}$/.test(cleanId) &&
               cleanId !== '000000000' &&
               !cleanId.startsWith('9');

      case 'ein':
        // EIN format: 9 digits, first two digits valid
        return /^\d{9}$/.test(cleanId) &&
               parseInt(cleanId.substring(0, 2)) >= 10 &&
               parseInt(cleanId.substring(0, 2)) <= 99;

      case 'itin':
        // ITIN format: 9 digits, starts with 9, middle digits 70-88 or 90-99
        if (!/^9\d{8}$/.test(cleanId)) return false;
        const middleDigits = parseInt(cleanId.substring(3, 5));
        return (middleDigits >= 70 && middleDigits <= 88) ||
               (middleDigits >= 90 && middleDigits <= 99);

      case 'foreign':
        // Foreign tax ID: allow alphanumeric, minimum 3 characters
        return /^[A-Za-z0-9]{3,}$/.test(cleanId);

      default:
        return false;
    }
  }
}
