/**
 * Layout Validation Utilities
 * 
 * Utilities to prevent layout regressions and ensure proper modern layout usage.
 * These utilities help detect when deprecated layout patterns are being used.
 */

/**
 * Validates that the modern layout structure is being used correctly
 * and warns about deprecated patterns.
 */
export function validateLayoutStructure() {
  if (typeof window === 'undefined') return; // Skip on server-side

  // Check for deprecated DashboardLayout usage in development
  if (process.env.NODE_ENV === 'development') {
    // Look for elements that might indicate DashboardLayout usage
    const deprecatedElements = document.querySelectorAll('[data-theme]');
    
    if (deprecatedElements.length > 1) {
      console.warn(
        '🚨 LAYOUT WARNING: Multiple elements with data-theme detected. ' +
        'This might indicate DashboardLayout is being used alongside ClientLayout. ' +
        'Remove DashboardLayout wrappers to prevent layout conflicts.'
      );
    }
  }
}

/**
 * Checks if the modern sidebar is properly rendered
 */
export function validateSidebarPresence() {
  if (typeof window === 'undefined') return false; // Skip on server-side
  
  // Check for the modern sidebar elements
  const sidebar = document.querySelector('.sidebar-smooth-transition');
  const sidebarProvider = document.querySelector('[data-sidebar-provider]');
  
  return {
    hasSidebar: !!sidebar,
    hasSidebarProvider: !!sidebarProvider,
    isModernLayout: !!sidebar || !!sidebarProvider
  };
}

/**
 * Validates mobile navigation is present
 */
export function validateMobileNavigation() {
  if (typeof window === 'undefined') return false; // Skip on server-side
  
  const mobileNav = document.querySelector('.mobile-bottom-nav-button');
  return !!mobileNav;
}

/**
 * Comprehensive layout health check
 */
export function performLayoutHealthCheck() {
  if (typeof window === 'undefined') return null; // Skip on server-side
  
  const sidebarCheck = validateSidebarPresence();
  const mobileNavCheck = validateMobileNavigation();
  
  const healthReport = {
    timestamp: new Date().toISOString(),
    sidebar: sidebarCheck,
    mobileNav: mobileNavCheck,
    isHealthy: sidebarCheck.isModernLayout && mobileNavCheck,
    warnings: []
  };
  
  if (!sidebarCheck.isModernLayout) {
    healthReport.warnings.push('Modern sidebar layout not detected');
  }
  
  if (!mobileNavCheck) {
    healthReport.warnings.push('Mobile navigation not detected');
  }
  
  if (process.env.NODE_ENV === 'development' && healthReport.warnings.length > 0) {
    console.warn('🚨 LAYOUT HEALTH CHECK FAILED:', healthReport);
  }
  
  return healthReport;
}

/**
 * Hook to run layout validation on component mount
 */
export function useLayoutValidation() {
  if (typeof window === 'undefined') return; // Skip on server-side
  
  React.useEffect(() => {
    // Run validation after a short delay to ensure DOM is ready
    const timer = setTimeout(() => {
      validateLayoutStructure();
      performLayoutHealthCheck();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
}

/**
 * ESLint rule helper - detects DashboardLayout imports in code
 */
export const DEPRECATED_LAYOUT_PATTERNS = [
  'import DashboardLayout',
  'from "../DashboardLayout"',
  'from "../../DashboardLayout"',
  'from "../../../DashboardLayout"',
  '<DashboardLayout>',
  '</DashboardLayout>'
];

/**
 * Development-only layout regression detector
 */
if (process.env.NODE_ENV === 'development') {
  // Run layout validation when the module loads
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      setTimeout(performLayoutHealthCheck, 2000);
    });
  }
}
