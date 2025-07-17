/**
 * Fee Configuration Service Exports
 * 
 * This file provides clean exports for the new FeeConfigurationService
 * to avoid module resolution issues in the main feeCalculations.ts file.
 */

export { 
  FeeConfigurationService,
  DEFAULT_FEE_STRUCTURE,
  type ComprehensiveFeeStructure
} from '../services/feeConfigurationService';
