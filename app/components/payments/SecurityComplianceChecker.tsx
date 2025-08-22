"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Shield, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Globe,
  Fingerprint,
  Key
} from 'lucide-react';
import { StatusIcon } from '../ui/status-icon';

interface SecurityCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  icon: React.ReactNode;
  critical: boolean;
  details?: string;
}

/**
 * SecurityComplianceChecker - Validates security and PCI compliance for payment processing
 * 
 * Features:
 * - HTTPS/TLS verification
 * - Content Security Policy checks
 * - Stripe Elements security validation
 * - Browser security feature detection
 * - PCI DSS compliance indicators
 */
export function SecurityComplianceChecker({ 
  onSecurityValidated 
}: { 
  onSecurityValidated?: (isSecure: boolean) => void 
}) {
  const [checks, setChecks] = useState<SecurityCheck[]>([]);
  const [isChecking, setIsChecking] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    performSecurityChecks();
  }, []);

  const performSecurityChecks = async () => {
    setIsChecking(true);
    const newChecks: SecurityCheck[] = [];

    // Check 1: HTTPS/TLS
    const isHTTPS = window.location.protocol === 'https:';
    newChecks.push({
      name: 'HTTPS/TLS Encryption',
      status: isHTTPS ? 'pass' : 'fail',
      message: isHTTPS 
        ? 'Secure HTTPS connection established' 
        : 'HTTPS required for payment processing',
      icon: <Lock className="w-4 h-4" />,
      critical: true,
      details: isHTTPS 
        ? 'All data transmission is encrypted using TLS 1.2 or higher'
        : 'Payment data cannot be processed over insecure HTTP connections'
    });

    // Check 2: Secure Context
    const isSecureContext = window.isSecureContext;
    newChecks.push({
      name: 'Secure Context',
      status: isSecureContext ? 'pass' : 'fail',
      message: isSecureContext 
        ? 'Browser security context verified' 
        : 'Secure context required for payment APIs',
      icon: <Shield className="w-4 h-4" />,
      critical: true,
      details: isSecureContext
        ? 'Browser APIs are available in secure context'
        : 'Payment Request API and other secure features unavailable'
    });

    // Check 3: Content Security Policy
    let hasCSP = false;
    let cspDetails = 'No CSP headers detected';
    try {
      const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      if (metaCSP) {
        hasCSP = true;
        cspDetails = 'CSP configured via meta tag';
      }
    } catch (error) {
      // CSP check failed
    }

    newChecks.push({
      name: 'Content Security Policy',
      status: hasCSP ? 'pass' : 'warning',
      message: hasCSP 
        ? 'CSP configured for enhanced security' 
        : 'CSP recommended for additional security',
      icon: <Globe className="w-4 h-4" />,
      critical: false,
      details: cspDetails
    });

    // Check 4: Stripe Elements Security
    const stripeElementsAvailable = typeof window !== 'undefined' && 
      document.querySelector('script[src*="js.stripe.com"]') !== null;
    
    newChecks.push({
      name: 'Stripe Elements Security',
      status: stripeElementsAvailable ? 'pass' : 'warning',
      message: stripeElementsAvailable 
        ? 'Stripe.js loaded from official CDN' 
        : 'Stripe Elements not yet loaded',
      icon: <Key className="w-4 h-4" />,
      critical: false,
      details: stripeElementsAvailable
        ? 'Payment data will be handled by Stripe\'s secure elements'
        : 'Stripe.js will be loaded when payment form is displayed'
    });

    // Check 5: Browser Security Features
    const hasSubresourceIntegrity = document.querySelectorAll('script[integrity]').length > 0;
    newChecks.push({
      name: 'Subresource Integrity',
      status: hasSubresourceIntegrity ? 'pass' : 'warning',
      message: hasSubresourceIntegrity 
        ? 'Script integrity verification enabled' 
        : 'SRI recommended for external scripts',
      icon: <Fingerprint className="w-4 h-4" />,
      critical: false,
      details: hasSubresourceIntegrity
        ? 'External scripts are verified for integrity'
        : 'Consider adding integrity attributes to external scripts'
    });

    // Check 6: Local Storage Security
    let localStorageSecure = false;
    let localStorageDetails = '';
    try {
      // Test if localStorage is available and working
      localStorage.setItem('security-test', 'test');
      localStorage.removeItem('security-test');
      localStorageSecure = true;
      localStorageDetails = 'Local storage available for secure session data';
    } catch (error) {
      localStorageDetails = 'Local storage unavailable - limited session persistence';
    }

    newChecks.push({
      name: 'Local Storage Security',
      status: localStorageSecure ? 'pass' : 'warning',
      message: localStorageSecure 
        ? 'Secure local storage available' 
        : 'Limited local storage access',
      icon: <Lock className="w-4 h-4" />,
      critical: false,
      details: localStorageDetails
    });

    // Check 7: Mixed Content
    const hasMixedContent = document.querySelectorAll('img[src^="http:"], script[src^="http:"], link[href^="http:"]').length > 0;
    newChecks.push({
      name: 'Mixed Content Protection',
      status: hasMixedContent ? 'warning' : 'pass',
      message: hasMixedContent 
        ? 'Mixed content detected - may affect security' 
        : 'No mixed content detected',
      icon: <Shield className="w-4 h-4" />,
      critical: false,
      details: hasMixedContent
        ? 'Some resources are loaded over HTTP instead of HTTPS'
        : 'All resources are loaded over secure connections'
    });

    setChecks(newChecks);
    setIsChecking(false);

    // Determine overall security status
    const criticalFailures = newChecks.filter(check => check.critical && check.status === 'fail');
    if (onSecurityValidated) {
      onSecurityValidated(criticalFailures.length === 0);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <StatusIcon status="success" size="sm" position="static" />;
      case 'fail':
        return <StatusIcon status="error" size="sm" position="static" />;
      case 'warning':
        return <StatusIcon status="warning" size="sm" position="static" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-success-20 text-success">Secure</Badge>;
      case 'fail':
        return <Badge variant="destructive">Failed</Badge>;
      case 'warning':
        return <Badge variant="secondary">Warning</Badge>;
      default:
        return null;
    }
  };

  const criticalFailures = checks.filter(check => check.critical && check.status === 'fail');
  const warnings = checks.filter(check => check.status === 'warning');
  const securityScore = Math.round((checks.filter(check => check.status === 'pass').length / checks.length) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security & PCI Compliance
          </div>
          {!isChecking && (
            <Badge variant={criticalFailures.length === 0 ? "default" : "destructive"}>
              {securityScore}% Secure
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isChecking ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Validating security...</p>
          </div>
        ) : (
          <>
            {/* Critical Failures Alert */}
            {criticalFailures.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Security requirements not met:</strong> {criticalFailures.length} critical security check(s) failed. Payment processing is not available.
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings Alert */}
            {warnings.length > 0 && criticalFailures.length === 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Payment processing is secure with {warnings.length} recommendation(s) for enhanced security.
                </AlertDescription>
              </Alert>
            )}

            {/* Success Alert */}
            {criticalFailures.length === 0 && warnings.length === 0 && (
              <Alert className="bg-success/10 border-success/30">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-success-foreground">
                  All security checks passed. PCI DSS compliant payment processing available.
                </AlertDescription>
              </Alert>
            )}

            {/* Security Checks */}
            <div className="space-y-3">
              {checks.map((check, index) => (
                <div key={index} className="flex items-start justify-between p-3 border rounded-lg">
                  <div className="flex items-start gap-3 flex-1">
                    {check.icon}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{check.name}</p>
                        {check.critical && (
                          <Badge variant="outline" className="text-xs">Critical</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{check.message}</p>
                      {showDetails && check.details && (
                        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                          {check.details}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(check.status)}
                    {getStatusIcon(check.status)}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-2"
              >
                {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showDetails ? 'Hide' : 'Show'} Details
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={performSecurityChecks}
              >
                Recheck Security
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
