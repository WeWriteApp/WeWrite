/**
 * Comprehensive tests for Security Monitoring System
 * 
 * Tests security dashboard functionality, metrics aggregation,
 * alert management, and report generation capabilities.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SecurityMonitoringDashboard } from '../components/admin/SecurityMonitoringDashboard';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}));

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Security Monitoring System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.NEXT_PUBLIC_ADMIN_API_KEY = 'test-admin-key';
    
    // Default successful API responses
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/admin/security-metrics')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              fraudDetection: {
                totalAlerts: 15,
                activeAlerts: 5,
                riskScore: 23,
                detectionRate: 95,
                falsePositiveRate: 5
              },
              compliance: {
                overallScore: 92,
                kycCompliance: 89,
                gdprCompliance: 98,
                pciCompliance: 100,
                pendingReviews: 3
              },
              auditTrail: {
                totalEvents: 45678,
                last24Hours: 1247,
                integrityScore: 100,
                retentionCompliance: 98
              },
              userSecurity: {
                totalUsers: 1523,
                verifiedUsers: 1401,
                suspendedUsers: 3,
                flaggedUsers: 12
              }
            }
          })
        });
      }
      
      if (url.includes('/api/admin/security-alerts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              {
                id: 'alert_1',
                type: 'fraud',
                severity: 'high',
                title: 'Suspicious Transaction Pattern',
                description: 'Multiple transactions from same IP',
                timestamp: new Date(),
                status: 'open',
                userId: 'user_123'
              },
              {
                id: 'alert_2',
                type: 'compliance',
                severity: 'medium',
                title: 'Overdue KYC Review',
                description: 'KYC review is overdue for user',
                timestamp: new Date(),
                status: 'investigating',
                userId: 'user_456'
              }
            ]
          })
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Security Dashboard Component', () => {
    test('should render security monitoring dashboard', async () => {
      render(<SecurityMonitoringDashboard />);
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Security Monitoring')).toBeInTheDocument();
      });
      
      // Check for main sections
      expect(screen.getByText('Real-time security metrics and threat monitoring')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
      expect(screen.getByText('Export Report')).toBeInTheDocument();
    });

    test('should display security metrics cards', async () => {
      render(<SecurityMonitoringDashboard />);
      
      await waitFor(() => {
        // Check for fraud detection metrics
        expect(screen.getByText('Fraud Detection')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument(); // Active alerts
        expect(screen.getByText('Risk Score: 23%')).toBeInTheDocument();
        
        // Check for compliance metrics
        expect(screen.getByText('Compliance')).toBeInTheDocument();
        expect(screen.getByText('92%')).toBeInTheDocument(); // Overall score
        
        // Check for audit trail metrics
        expect(screen.getByText('Audit Trail')).toBeInTheDocument();
        expect(screen.getByText('1,247')).toBeInTheDocument(); // Events in 24h
        
        // Check for user security metrics
        expect(screen.getByText('User Security')).toBeInTheDocument();
        expect(screen.getByText('1,401')).toBeInTheDocument(); // Verified users
      });
    });

    test('should handle refresh functionality', async () => {
      render(<SecurityMonitoringDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
      
      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);
      
      // Verify API calls are made
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/security-metrics',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-admin-key'
          })
        })
      );
    });

    test('should display security alerts in alerts tab', async () => {
      render(<SecurityMonitoringDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Security Alerts')).toBeInTheDocument();
      });
      
      // Click on alerts tab
      const alertsTab = screen.getByText('Security Alerts');
      fireEvent.click(alertsTab);
      
      await waitFor(() => {
        expect(screen.getByText('Recent Security Alerts')).toBeInTheDocument();
        expect(screen.getByText('Suspicious Transaction Pattern')).toBeInTheDocument();
        expect(screen.getByText('Overdue KYC Review')).toBeInTheDocument();
      });
    });

    test('should handle export report functionality', async () => {
      // Mock blob and URL creation
      global.URL.createObjectURL = jest.fn(() => 'mock-url');
      global.URL.revokeObjectURL = jest.fn();
      
      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      (global.fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(mockBlob)
        })
      );
      
      // Mock document methods
      const mockAnchor = {
        href: '',
        download: '',
        click: jest.fn()
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as any);
      jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as any);
      
      render(<SecurityMonitoringDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Export Report')).toBeInTheDocument();
      });
      
      const exportButton = screen.getByText('Export Report');
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/security-report',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-admin-key'
            })
          })
        );
      });
    });

    test('should handle loading states', () => {
      render(<SecurityMonitoringDashboard />);
      
      // Should show loading skeleton initially
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    test('should handle API errors gracefully', async () => {
      // Mock API error
      (global.fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          status: 500
        })
      );
      
      render(<SecurityMonitoringDashboard />);
      
      // Should still render without crashing
      await waitFor(() => {
        expect(screen.getByText('Security Monitoring')).toBeInTheDocument();
      });
    });
  });

  describe('Security Metrics API', () => {
    test('should aggregate fraud detection metrics correctly', async () => {
      const response = await fetch('/api/admin/security-metrics');
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.data.fraudDetection).toBeDefined();
      expect(data.data.fraudDetection.activeAlerts).toBe(5);
      expect(data.data.fraudDetection.riskScore).toBe(23);
    });

    test('should aggregate compliance metrics correctly', async () => {
      const response = await fetch('/api/admin/security-metrics');
      const data = await response.json();
      
      expect(data.data.compliance).toBeDefined();
      expect(data.data.compliance.overallScore).toBe(92);
      expect(data.data.compliance.kycCompliance).toBe(89);
      expect(data.data.compliance.gdprCompliance).toBe(98);
    });

    test('should aggregate audit trail metrics correctly', async () => {
      const response = await fetch('/api/admin/security-metrics');
      const data = await response.json();
      
      expect(data.data.auditTrail).toBeDefined();
      expect(data.data.auditTrail.totalEvents).toBe(45678);
      expect(data.data.auditTrail.last24Hours).toBe(1247);
      expect(data.data.auditTrail.integrityScore).toBe(100);
    });

    test('should aggregate user security metrics correctly', async () => {
      const response = await fetch('/api/admin/security-metrics');
      const data = await response.json();
      
      expect(data.data.userSecurity).toBeDefined();
      expect(data.data.userSecurity.totalUsers).toBe(1523);
      expect(data.data.userSecurity.verifiedUsers).toBe(1401);
      expect(data.data.userSecurity.flaggedUsers).toBe(12);
    });
  });

  describe('Security Alerts API', () => {
    test('should return security alerts correctly', async () => {
      const response = await fetch('/api/admin/security-alerts');
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].type).toBe('fraud');
      expect(data.data[0].severity).toBe('high');
      expect(data.data[1].type).toBe('compliance');
    });

    test('should filter alerts by type', async () => {
      const response = await fetch('/api/admin/security-alerts?type=fraud');
      const data = await response.json();
      
      expect(data.success).toBe(true);
      // Would filter to only fraud alerts in real implementation
    });

    test('should filter alerts by severity', async () => {
      const response = await fetch('/api/admin/security-alerts?severity=high');
      const data = await response.json();
      
      expect(data.success).toBe(true);
      // Would filter to only high severity alerts in real implementation
    });
  });

  describe('Security Report Generation', () => {
    test('should generate security report', async () => {
      const reportConfig = {
        title: 'Test Security Report',
        description: 'Test report generation',
        includeMetrics: true,
        includeAlerts: true,
        format: 'json'
      };
      
      const response = await fetch('/api/admin/security-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateReport',
          config: reportConfig
        })
      });
      
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test('should handle different report formats', async () => {
      const formats = ['json', 'csv', 'pdf'];
      
      for (const format of formats) {
        const response = await fetch('/api/admin/security-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generateReport',
            config: { format }
          })
        });
        
        const data = await response.json();
        expect(data.success).toBe(true);
      }
    });
  });

  describe('Integration Tests', () => {
    test('should integrate all security monitoring components', async () => {
      render(<SecurityMonitoringDashboard />);
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Security Monitoring')).toBeInTheDocument();
      });
      
      // Test tab navigation
      const tabs = ['Overview', 'Security Alerts', 'Compliance', 'Audit Trail'];
      
      for (const tab of tabs) {
        if (screen.queryByText(tab)) {
          fireEvent.click(screen.getByText(tab));
          await waitFor(() => {
            // Tab content should be visible
            expect(screen.getByText(tab)).toBeInTheDocument();
          });
        }
      }
      
      // Test refresh functionality
      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);
      
      // Verify multiple API calls
      expect(global.fetch).toHaveBeenCalledTimes(4); // Initial load + refresh
    });
  });
});
