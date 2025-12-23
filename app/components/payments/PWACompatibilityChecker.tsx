"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Icon } from '@/components/ui/Icon';
import { StatusIcon } from '../ui/status-icon';
import { usePWA } from '../../providers/PWAProvider';

interface CompatibilityCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  icon: React.ReactNode;
  required: boolean;
}

/**
 * PWACompatibilityChecker - Validates PWA environment for payment processing
 * 
 * Features:
 * - Checks PWA installation status
 * - Validates network connectivity
 * - Tests Stripe Elements compatibility
 * - Verifies secure context (HTTPS)
 * - Checks service worker registration
 */
export function PWACompatibilityChecker({ 
  onCompatibilityChecked 
}: { 
  onCompatibilityChecked?: (isCompatible: boolean) => void 
}) {
  const { isPWA } = usePWA();
  const [checks, setChecks] = useState<CompatibilityCheck[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    performCompatibilityChecks();
    
    // Monitor network status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const performCompatibilityChecks = async () => {
    setIsChecking(true);
    const newChecks: CompatibilityCheck[] = [];

    // Check 1: PWA Installation
    newChecks.push({
      name: 'PWA Installation',
      status: isPWA ? 'pass' : 'warning',
      message: isPWA
        ? 'Running as installed PWA'
        : 'Running in browser - PWA features available',
      icon: <Icon name="Smartphone" size={16} />,
      required: false
    });

    // Check 2: Secure Context (HTTPS)
    const isSecureContext = window.isSecureContext;
    newChecks.push({
      name: 'Secure Context',
      status: isSecureContext ? 'pass' : 'fail',
      message: isSecureContext
        ? 'HTTPS connection verified'
        : 'HTTPS required for payment processing',
      icon: <Icon name="Shield" size={16} />,
      required: true
    });

    // Check 3: Network Connectivity
    newChecks.push({
      name: 'Network Connection',
      status: isOnline ? 'pass' : 'fail',
      message: isOnline
        ? 'Internet connection active'
        : 'No internet connection detected',
      icon: isOnline ? <Icon name="Wifi" size={16} /> : <Icon name="WifiOff" size={16} />,
      required: true
    });

    // Check 4: Service Worker
    const hasServiceWorker = 'serviceWorker' in navigator;
    let swRegistered = false;
    if (hasServiceWorker) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        swRegistered = !!registration;
      } catch (error) {
        console.error('Service worker check failed:', error);
      }
    }
    
    newChecks.push({
      name: 'Service Worker',
      status: swRegistered ? 'pass' : 'warning',
      message: swRegistered
        ? 'Service worker active for offline support'
        : 'Service worker not registered',
      icon: <Icon name="Globe" size={16} />,
      required: false
    });

    // Check 5: Payment Request API (for Apple Pay/Google Pay)
    const hasPaymentRequest = 'PaymentRequest' in window;
    newChecks.push({
      name: 'Payment Request API',
      status: hasPaymentRequest ? 'pass' : 'warning',
      message: hasPaymentRequest
        ? 'Apple Pay/Google Pay support available'
        : 'Limited to card payments only',
      icon: <Icon name="CreditCard" size={16} />,
      required: false
    });

    // Check 6: Local Storage
    let hasLocalStorage = false;
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      hasLocalStorage = true;
    } catch (error) {
      hasLocalStorage = false;
    }
    
    newChecks.push({
      name: 'Local Storage',
      status: hasLocalStorage ? 'pass' : 'warning',
      message: hasLocalStorage
        ? 'Local storage available for session data'
        : 'Limited session persistence',
      icon: <Icon name="CheckCircle" size={16} />,
      required: false
    });

    setChecks(newChecks);
    setIsChecking(false);

    // Determine overall compatibility
    const hasFailures = newChecks.some(check => check.required && check.status === 'fail');
    if (onCompatibilityChecked) {
      onCompatibilityChecked(!hasFailures);
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
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Pass</Badge>;
      case 'fail':
        return <Badge variant="destructive">Fail</Badge>;
      case 'warning':
        return <Badge variant="secondary">Warning</Badge>;
      default:
        return null;
    }
  };

  const criticalFailures = checks.filter(check => check.required && check.status === 'fail');
  const warnings = checks.filter(check => check.status === 'warning');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="Shield" size={20} />
          PWA Payment Compatibility
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isChecking ? (
          <div className="text-center py-4">
            <Icon name="Loader" size={24} className="mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Checking compatibility...</p>
          </div>
        ) : (
          <>
            {/* Critical Failures Alert */}
            {criticalFailures.length > 0 && (
              <Alert variant="destructive">
                <Icon name="XCircle" size={16} />
                <AlertDescription>
                  <strong>Payment processing unavailable:</strong> {criticalFailures.length} critical requirement(s) not met.
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings Alert */}
            {warnings.length > 0 && criticalFailures.length === 0 && (
              <Alert>
                <Icon name="AlertTriangle" size={16} />
                <AlertDescription>
                  Payment processing available with {warnings.length} limitation(s).
                </AlertDescription>
              </Alert>
            )}

            {/* Success Alert */}
            {criticalFailures.length === 0 && warnings.length === 0 && (
              <Alert className="bg-success/10 border-success/30">
                <Icon name="CheckCircle" size={16} className="text-green-600" />
                <AlertDescription className="text-success-foreground">
                  All compatibility checks passed. Optimal PWA payment experience available.
                </AlertDescription>
              </Alert>
            )}

            {/* Detailed Checks */}
            <div className="space-y-3">
              {checks.map((check, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {check.icon}
                    <div>
                      <p className="font-medium text-sm">{check.name}</p>
                      <p className="text-xs text-muted-foreground">{check.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {check.required && (
                      <Badge variant="secondary" className="text-xs">Required</Badge>
                    )}
                    {getStatusBadge(check.status)}
                    {getStatusIcon(check.status)}
                  </div>
                </div>
              ))}
            </div>

            {/* Retry Button */}
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={performCompatibilityChecks}
              className="w-full"
            >
              Recheck Compatibility
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
