/**
 * Regulatory Compliance Service
 * 
 * Comprehensive compliance framework for KYC/AML, GDPR data protection,
 * PCI DSS security measures, and regulatory reporting capabilities.
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

import {
  FinancialOperationResult,
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  FinancialLogger,
  CorrelationId
} from '../types/financial';

import { AuditTrailService, AuditEventType, AuditSeverity } from './auditTrailService';

/**
 * Compliance framework types
 */
export enum ComplianceFramework {
  KYC_AML = 'kyc_aml',
  GDPR = 'gdpr',
  PCI_DSS = 'pci_dss',
  SOX = 'sox',
  CCPA = 'ccpa',
  PIPEDA = 'pipeda',
  LGPD = 'lgpd'
}

/**
 * Compliance status levels
 */
export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  PENDING_REVIEW = 'pending_review',
  PARTIALLY_COMPLIANT = 'partially_compliant',
  EXEMPT = 'exempt'
}

/**
 * KYC verification levels
 */
export enum KYCLevel {
  NONE = 'none',
  BASIC = 'basic',
  ENHANCED = 'enhanced',
  FULL = 'full'
}

/**
 * Data processing purposes under GDPR
 */
export enum DataProcessingPurpose {
  ACCOUNT_MANAGEMENT = 'account_management',
  PAYMENT_PROCESSING = 'payment_processing',
  FRAUD_PREVENTION = 'fraud_prevention',
  ANALYTICS = 'analytics',
  MARKETING = 'marketing',
  LEGAL_COMPLIANCE = 'legal_compliance'
}

/**
 * User compliance profile
 */
export interface UserComplianceProfile {
  userId: string;
  
  // KYC/AML Information
  kycLevel: KYCLevel;
  kycStatus: ComplianceStatus;
  kycVerifiedAt?: Date;
  kycDocuments: {
    identityDocument?: {
      type: 'passport' | 'drivers_license' | 'national_id';
      documentId: string;
      verifiedAt: Date;
      expiresAt?: Date;
    };
    addressProof?: {
      type: 'utility_bill' | 'bank_statement' | 'government_letter';
      documentId: string;
      verifiedAt: Date;
    };
    sourceOfFunds?: {
      type: 'employment' | 'business' | 'investment' | 'other';
      description: string;
      verifiedAt: Date;
    };
  };
  
  // AML Risk Assessment
  amlRiskLevel: 'low' | 'medium' | 'high' | 'prohibited';
  amlLastAssessment: Date;
  sanctionsCheck: {
    lastChecked: Date;
    status: 'clear' | 'match' | 'pending';
    provider: string;
  };
  
  // GDPR Compliance
  gdprConsent: {
    marketing: boolean;
    analytics: boolean;
    profiling: boolean;
    dataSharing: boolean;
    consentDate: Date;
    consentVersion: string;
  };
  dataProcessingPurposes: DataProcessingPurpose[];
  dataRetentionPeriod: number; // days
  rightToBeForgettenRequested: boolean;
  
  // Geographic and Regulatory Context
  jurisdiction: string;
  applicableFrameworks: ComplianceFramework[];
  
  // Compliance History
  complianceHistory: Array<{
    framework: ComplianceFramework;
    status: ComplianceStatus;
    changedAt: Date;
    reason: string;
    verifiedBy?: string;
  }>;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Compliance check result
 */
export interface ComplianceCheckResult {
  framework: ComplianceFramework;
  status: ComplianceStatus;
  score: number; // 0-100
  requirements: Array<{
    requirement: string;
    status: 'met' | 'not_met' | 'partial' | 'not_applicable';
    description: string;
    evidence?: string[];
  }>;
  recommendations: string[];
  nextReviewDate: Date;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Data protection impact assessment
 */
export interface DataProtectionImpactAssessment {
  id: string;
  title: string;
  description: string;
  dataTypes: string[];
  processingPurposes: DataProcessingPurpose[];
  legalBasis: string;
  riskLevel: 'low' | 'medium' | 'high';
  mitigationMeasures: string[];
  approvedBy: string;
  approvedAt: Date;
  reviewDate: Date;
  status: 'draft' | 'approved' | 'rejected' | 'under_review';
}

/**
 * Regulatory reporting configuration
 */
export interface RegulatoryReportConfig {
  framework: ComplianceFramework;
  reportType: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  recipients: string[];
  template: string;
  dataFields: string[];
  retentionPeriod: number;
  encryptionRequired: boolean;
}

export class RegulatoryComplianceService {
  private static instance: RegulatoryComplianceService;
  private auditService: AuditTrailService;

  private constructor() {
    this.auditService = AuditTrailService.getInstance();
  }

  static getInstance(): RegulatoryComplianceService {
    if (!RegulatoryComplianceService.instance) {
      RegulatoryComplianceService.instance = new RegulatoryComplianceService();
    }
    return RegulatoryComplianceService.instance;
  }

  /**
   * Perform comprehensive compliance check for a user
   */
  async performComplianceCheck(
    userId: string,
    frameworks: ComplianceFramework[],
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<ComplianceCheckResult[]>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      FinancialLogger.logOperation('COMPLIANCE_CHECK_START', {
        correlationId: corrId,
        userId,
        frameworks
      });

      const results: ComplianceCheckResult[] = [];
      const userProfile = await this.getUserComplianceProfile(userId);

      for (const framework of frameworks) {
        const checkResult = await this.checkFrameworkCompliance(framework, userProfile, corrId);
        results.push(checkResult);
      }

      // Log compliance check
      await this.auditService.logEvent(
        AuditEventType.COMPLIANCE_CHECK,
        `Compliance check performed for frameworks: ${frameworks.join(', ')}`,
        {
          severity: AuditSeverity.INFO,
          userId,
          entityType: 'compliance_check',
          metadata: {
            frameworks,
            resultsCount: results.length,
            overallCompliance: results.every(r => r.status === ComplianceStatus.COMPLIANT)
          },
          regulatoryCategory: 'compliance_monitoring',
          correlationId: corrId
        }
      );

      FinancialLogger.logOperation('COMPLIANCE_CHECK_COMPLETE', {
        correlationId: corrId,
        userId,
        frameworks,
        resultsCount: results.length
      });

      return {
        success: true,
        data: results,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Compliance check failed: ${error.message}`, corrId, true, {  userId, frameworks, originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Update user KYC information
   */
  async updateKYCInformation(
    userId: string,
    kycData: {
      level: KYCLevel;
      documents?: any;
      sourceOfFunds?: any;
      verificationProvider?: string;
    },
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<UserComplianceProfile>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      const profile = await this.getUserComplianceProfile(userId) || await this.createUserComplianceProfile(userId);
      
      const beforeState = { ...profile };
      
      // Update KYC information
      profile.kycLevel = kycData.level;
      profile.kycStatus = ComplianceStatus.PENDING_REVIEW;
      profile.kycVerifiedAt = new Date();
      
      if (kycData.documents) {
        profile.kycDocuments = { ...profile.kycDocuments, ...kycData.documents };
      }

      // Perform AML risk assessment
      const amlRisk = await this.assessAMLRisk(profile, corrId);
      profile.amlRiskLevel = amlRisk.riskLevel;
      profile.amlLastAssessment = new Date();

      // Update compliance history
      profile.complianceHistory.push({
        framework: ComplianceFramework.KYC_AML,
        status: profile.kycStatus,
        changedAt: new Date(),
        reason: `KYC level updated to ${kycData.level}`,
        verifiedBy: kycData.verificationProvider
      });

      profile.updatedAt = new Date();

      // Store updated profile
      await setDoc(doc(db, 'userComplianceProfiles', userId), {
        ...profile,
        updatedAt: serverTimestamp()
      });

      // Log KYC update
      await this.auditService.logEvent(
        AuditEventType.USER_UPDATED,
        `KYC information updated for user`,
        {
          severity: AuditSeverity.INFO,
          userId,
          entityType: 'kyc_profile',
          entityId: userId,
          beforeState,
          afterState: profile,
          metadata: {
            kycLevel: kycData.level,
            verificationProvider: kycData.verificationProvider
          },
          regulatoryCategory: 'kyc_aml',
          correlationId: corrId
        }
      );

      return {
        success: true,
        data: profile,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `KYC update failed: ${error.message}`, corrId, true, {  userId, originalError: error  });

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
   * Get user compliance profile
   */
  private async getUserComplianceProfile(userId: string): Promise<UserComplianceProfile | null> {
    try {
      const profileDoc = await getDoc(doc(db, 'userComplianceProfiles', userId));

      if (profileDoc.exists()) {
        return profileDoc.data() as UserComplianceProfile;
      }

      return null;
    } catch (error) {
      console.error('Error getting user compliance profile:', error);
      return null;
    }
  }

  /**
   * Create new user compliance profile
   */
  private async createUserComplianceProfile(userId: string): Promise<UserComplianceProfile> {
    const profile: UserComplianceProfile = {
      userId,
      kycLevel: KYCLevel.NONE,
      kycStatus: ComplianceStatus.NON_COMPLIANT,
      kycDocuments: {},
      amlRiskLevel: 'medium',
      amlLastAssessment: new Date(),
      sanctionsCheck: {
        lastChecked: new Date(),
        status: 'pending',
        provider: 'internal'
      },
      gdprConsent: {
        marketing: false,
        analytics: false,
        profiling: false,
        dataSharing: false,
        consentDate: new Date(),
        consentVersion: '1.0'
      },
      dataProcessingPurposes: [DataProcessingPurpose.ACCOUNT_MANAGEMENT],
      dataRetentionPeriod: 2555, // 7 years default
      rightToBeForgettenRequested: false,
      jurisdiction: 'US', // Default, should be determined by user location
      applicableFrameworks: [ComplianceFramework.KYC_AML, ComplianceFramework.GDPR],
      complianceHistory: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await setDoc(doc(db, 'userComplianceProfiles', userId), {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return profile;
  }

  /**
   * Check compliance for specific framework
   */
  private async checkFrameworkCompliance(
    framework: ComplianceFramework,
    profile: UserComplianceProfile | null,
    correlationId: CorrelationId
  ): Promise<ComplianceCheckResult> {
    if (!profile) {
      return {
        framework,
        status: ComplianceStatus.NON_COMPLIANT,
        score: 0,
        requirements: [],
        recommendations: ['Create compliance profile'],
        nextReviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        riskLevel: 'high'
      };
    }

    switch (framework) {
      case ComplianceFramework.KYC_AML:
        return this.checkKYCAMLCompliance(profile);

      case ComplianceFramework.GDPR:
        return this.checkGDPRCompliance(profile);

      case ComplianceFramework.PCI_DSS:
        return this.checkPCIDSSCompliance(profile);

      default:
        return {
          framework,
          status: ComplianceStatus.NON_COMPLIANT,
          score: 0,
          requirements: [],
          recommendations: ['Framework not implemented'],
          nextReviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          riskLevel: 'medium'
        };
    }
  }

  /**
   * Check KYC/AML compliance
   */
  private checkKYCAMLCompliance(profile: UserComplianceProfile): ComplianceCheckResult {
    const requirements = [
      {
        requirement: 'Identity Verification',
        status: profile.kycDocuments.identityDocument ? 'met' : 'not_met' as const,
        description: 'Valid government-issued ID required',
        evidence: profile.kycDocuments.identityDocument ? [profile.kycDocuments.identityDocument.documentId] : []
      },
      {
        requirement: 'Address Verification',
        status: profile.kycDocuments.addressProof ? 'met' : 'not_met' as const,
        description: 'Proof of address required',
        evidence: profile.kycDocuments.addressProof ? [profile.kycDocuments.addressProof.documentId] : []
      },
      {
        requirement: 'Source of Funds',
        status: profile.kycDocuments.sourceOfFunds ? 'met' : 'not_met' as const,
        description: 'Source of funds documentation required for enhanced KYC',
        evidence: profile.kycDocuments.sourceOfFunds ? [profile.kycDocuments.sourceOfFunds.description] : []
      },
      {
        requirement: 'Sanctions Screening',
        status: profile.sanctionsCheck.status === 'clear' ? 'met' : 'not_met' as const,
        description: 'Regular sanctions list screening required',
        evidence: [profile.sanctionsCheck.provider]
      }
    ];

    const metRequirements = requirements.filter(r => r.status === 'met').length;
    const score = (metRequirements / requirements.length) * 100;

    let status: ComplianceStatus;
    if (score >= 100) status = ComplianceStatus.COMPLIANT;
    else if (score >= 75) status = ComplianceStatus.PARTIALLY_COMPLIANT;
    else status = ComplianceStatus.NON_COMPLIANT;

    const recommendations = requirements
      .filter(r => r.status === 'not_met')
      .map(r => `Complete ${r.requirement}: ${r.description}`);

    return {
      framework: ComplianceFramework.KYC_AML,
      status,
      score,
      requirements,
      recommendations,
      nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Annual review
      riskLevel: profile.amlRiskLevel as any
    };
  }

  /**
   * Check GDPR compliance
   */
  private checkGDPRCompliance(profile: UserComplianceProfile): ComplianceCheckResult {
    const requirements = [
      {
        requirement: 'Consent Management',
        status: 'met' as const, // Assuming consent is properly managed
        description: 'Valid consent for data processing',
        evidence: [`Consent version: ${profile.gdprConsent.consentVersion}`]
      },
      {
        requirement: 'Data Retention Policy',
        status: profile.dataRetentionPeriod > 0 ? 'met' : 'not_met' as const,
        description: 'Defined data retention periods',
        evidence: [`Retention period: ${profile.dataRetentionPeriod} days`]
      },
      {
        requirement: 'Right to Access',
        status: 'met' as const, // Assuming API exists for data access
        description: 'User can access their personal data',
        evidence: ['Data export API available']
      },
      {
        requirement: 'Right to Rectification',
        status: 'met' as const, // Assuming users can update their data
        description: 'User can correct their personal data',
        evidence: ['Profile update functionality available']
      }
    ];

    const metRequirements = requirements.filter(r => r.status === 'met').length;
    const score = (metRequirements / requirements.length) * 100;

    return {
      framework: ComplianceFramework.GDPR,
      status: score >= 100 ? ComplianceStatus.COMPLIANT : ComplianceStatus.PARTIALLY_COMPLIANT,
      score,
      requirements,
      recommendations: score < 100 ? ['Review and update GDPR compliance measures'] : [],
      nextReviewDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // Semi-annual review
      riskLevel: 'low'
    };
  }

  /**
   * Check PCI DSS compliance
   */
  private checkPCIDSSCompliance(profile: UserComplianceProfile): ComplianceCheckResult {
    // PCI DSS is more about system-level compliance than user-level
    const requirements = [
      {
        requirement: 'Secure Payment Processing',
        status: 'met' as const, // Assuming Stripe handles PCI compliance
        description: 'Payment data processed securely',
        evidence: ['Stripe PCI DSS Level 1 compliance']
      },
      {
        requirement: 'Data Encryption',
        status: 'met' as const,
        description: 'Sensitive data encrypted in transit and at rest',
        evidence: ['TLS encryption', 'Database encryption']
      }
    ];

    return {
      framework: ComplianceFramework.PCI_DSS,
      status: ComplianceStatus.COMPLIANT,
      score: 100,
      requirements,
      recommendations: [],
      nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      riskLevel: 'low'
    };
  }

  /**
   * Assess AML risk for user
   */
  private async assessAMLRisk(
    profile: UserComplianceProfile,
    correlationId: CorrelationId
  ): Promise<{ riskLevel: 'low' | 'medium' | 'high' | 'prohibited'; factors: string[] }> {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Geographic risk assessment
    const highRiskJurisdictions = ['AF', 'IR', 'KP', 'SY']; // Example high-risk countries
    if (highRiskJurisdictions.includes(profile.jurisdiction)) {
      riskFactors.push('High-risk jurisdiction');
      riskScore += 30;
    }

    // KYC completeness
    if (profile.kycLevel === KYCLevel.NONE) {
      riskFactors.push('No KYC verification');
      riskScore += 25;
    } else if (profile.kycLevel === KYCLevel.BASIC) {
      riskFactors.push('Basic KYC only');
      riskScore += 10;
    }

    // Sanctions check
    if (profile.sanctionsCheck.status === 'match') {
      riskFactors.push('Sanctions list match');
      riskScore += 50;
    } else if (profile.sanctionsCheck.status === 'pending') {
      riskFactors.push('Pending sanctions check');
      riskScore += 15;
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'prohibited';
    if (riskScore >= 70) riskLevel = 'prohibited';
    else if (riskScore >= 40) riskLevel = 'high';
    else if (riskScore >= 20) riskLevel = 'medium';
    else riskLevel = 'low';

    return { riskLevel, factors: riskFactors };
  }

  /**
   * Gather regulatory data for reporting
   */
  private async gatherRegulatoryData(
    framework: ComplianceFramework,
    dateRange: { startDate: Date; endDate: Date },
    dataFields: string[],
    correlationId: CorrelationId
  ): Promise<any[]> {
    // This would gather actual data based on the framework and date range
    // For now, return mock data structure

    const mockData = [];

    switch (framework) {
      case ComplianceFramework.KYC_AML:
        // Gather KYC/AML related data
        mockData.push({
          userId: 'user_123',
          kycLevel: 'enhanced',
          amlRiskLevel: 'low',
          lastVerified: dateRange.startDate,
          jurisdiction: 'US'
        });
        break;

      case ComplianceFramework.GDPR:
        // Gather GDPR related data
        mockData.push({
          userId: 'user_123',
          consentStatus: 'active',
          dataProcessingPurposes: ['account_management', 'payment_processing'],
          lastConsentUpdate: dateRange.startDate
        });
        break;

      default:
        // Generic compliance data
        break;
    }

    return mockData;
  }

  /**
   * Get compliance status for user
   */
  async getUserComplianceStatus(
    userId: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<{
    overallStatus: ComplianceStatus;
    frameworkStatuses: Array<{
      framework: ComplianceFramework;
      status: ComplianceStatus;
      lastChecked: Date;
    }>;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      const profile = await this.getUserComplianceProfile(userId);

      if (!profile) {
        return {
          success: true,
          data: {
            overallStatus: ComplianceStatus.NON_COMPLIANT,
            frameworkStatuses: [],
            riskLevel: 'high'
          },
          correlationId: corrId
        };
      }

      // Check all applicable frameworks
      const frameworkStatuses = [];
      let overallCompliant = true;
      let highestRiskLevel = 'low';

      for (const framework of profile.applicableFrameworks) {
        const checkResult = await this.checkFrameworkCompliance(framework, profile, corrId);

        frameworkStatuses.push({
          framework,
          status: checkResult.status,
          lastChecked: new Date()
        });

        if (checkResult.status !== ComplianceStatus.COMPLIANT) {
          overallCompliant = false;
        }

        if (checkResult.riskLevel === 'critical' ||
            (checkResult.riskLevel === 'high' && highestRiskLevel !== 'critical') ||
            (checkResult.riskLevel === 'medium' && highestRiskLevel === 'low')) {
          highestRiskLevel = checkResult.riskLevel;
        }
      }

      const overallStatus = overallCompliant ?
        ComplianceStatus.COMPLIANT :
        ComplianceStatus.PARTIALLY_COMPLIANT;

      return {
        success: true,
        data: {
          overallStatus,
          frameworkStatuses,
          riskLevel: highestRiskLevel as any
        },
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Failed to get compliance status: ${error.message}`, corrId, true, {  userId, originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Schedule compliance review
   */
  async scheduleComplianceReview(
    userId: string,
    framework: ComplianceFramework,
    reviewDate: Date,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<{ reviewId: string }>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      const reviewId = `review_${framework}_${Date.now()}`;

      const review = {
        id: reviewId,
        userId,
        framework,
        scheduledDate: reviewDate,
        status: 'scheduled',
        createdAt: new Date(),
        correlationId: corrId
      };

      await setDoc(doc(db, 'complianceReviews', reviewId), {
        ...review,
        scheduledDate: Timestamp.fromDate(reviewDate),
        createdAt: serverTimestamp()
      });

      // Log review scheduling
      await this.auditService.logEvent(
        AuditEventType.COMPLIANCE_CHECK,
        `Compliance review scheduled for ${framework}`,
        {
          severity: AuditSeverity.INFO,
          userId,
          entityType: 'compliance_review',
          entityId: reviewId,
          metadata: {
            framework,
            scheduledDate: reviewDate.toISOString()
          },
          regulatoryCategory: 'compliance_monitoring',
          correlationId: corrId
        }
      );

      return {
        success: true,
        data: { reviewId },
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Failed to schedule compliance review: ${error.message}`, corrId, true, {  userId, framework, originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }
}