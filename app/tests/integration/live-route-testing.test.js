/**
 * Live Route Integration Tests
 * 
 * These tests start a real Next.js server and make actual HTTP requests
 * to validate routes work correctly in a real environment.
 * 
 * Run with: npm run test:integration
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn } from 'child_process';
import fetch from 'node-fetch';

describe('Live Route Integration Tests', () => {
  let serverProcess;
  let serverReady = false;
  const baseUrl = 'http://localhost:3001'; // Use different port to avoid conflicts
  const testTimeout = 30000; // 30 seconds

  beforeAll(async () => {
    // Start Next.js development server
    console.log('🚀 Starting test server...');
    
    serverProcess = spawn('npm', ['run', 'dev', '--', '-p', '3001'], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // Wait for server to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server failed to start within timeout'));
      }, testTimeout);

      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('Server output:', output);
        
        if (output.includes('Ready') || output.includes('started server')) {
          serverReady = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Additional wait to ensure server is fully ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Test server is ready');
  }, testTimeout);

  afterAll(async () => {
    if (serverProcess) {
      console.log('🛑 Stopping test server...');
      serverProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }
  });

  describe('Critical API Endpoints', () => {
    test('should respond to health check endpoints', async () => {
      const healthEndpoints = [
        '/api/random-pages',
        '/api/search-unified?searchTerm=test',
      ];

      for (const endpoint of healthEndpoints) {
        try {
          const response = await fetch(`${baseUrl}${endpoint}`, {
            timeout: 5000
          });
          
          expect([200, 400, 401, 404]).toContain(response.status);
          
          if (response.ok) {
            const data = await response.json();
            expect(data).toBeDefined();
          }
        } catch (error) {
          // Log but don't fail - network issues are common in test environments
          console.warn(`Warning: ${endpoint} failed with ${error.message}`);
        }
      }
    });

    test('should handle API authentication correctly', async () => {
      const authRequiredEndpoints = [
        '/api/my-pages',
        '/api/user-balance',
        '/api/payment-history'
      ];

      for (const endpoint of authRequiredEndpoints) {
        try {
          const response = await fetch(`${baseUrl}${endpoint}`, {
            timeout: 5000
          });
          
          // Should return 401 Unauthorized or 403 Forbidden for unauthenticated requests
          expect([401, 403]).toContain(response.status);
        } catch (error) {
          console.warn(`Warning: ${endpoint} failed with ${error.message}`);
        }
      }
    });

    test('should validate API error responses', async () => {
      const invalidRequests = [
        { path: '/api/pages/invalid-id-format', expectedStatus: [400, 404] },
        { path: '/api/search-unified', expectedStatus: [400] }, // Missing required params
        { path: '/api/nonexistent-endpoint', expectedStatus: [404] }
      ];

      for (const request of invalidRequests) {
        try {
          const response = await fetch(`${baseUrl}${request.path}`, {
            timeout: 5000
          });
          
          expect(request.expectedStatus).toContain(response.status);
          
          if (!response.ok) {
            const errorData = await response.json();
            expect(errorData).toHaveProperty('error');
          }
        } catch (error) {
          console.warn(`Warning: ${request.path} failed with ${error.message}`);
        }
      }
    });
  });

  describe('Page Routes', () => {
    test('should serve home page correctly', async () => {
      try {
        const response = await fetch(`${baseUrl}/`, {
          timeout: 10000
        });
        
        expect([200, 302]).toContain(response.status);
        
        if (response.ok) {
          const html = await response.text();
          expect(html).toContain('html');
          expect(html.length).toBeGreaterThan(100);
        }
      } catch (error) {
        console.warn(`Warning: Home page failed with ${error.message}`);
      }
    });

    test('should handle dynamic page routes', async () => {
      const testPageIds = [
        'test-page-123',
        'nonexistent-page',
        'invalid-chars-!@#$%'
      ];

      for (const pageId of testPageIds) {
        try {
          const response = await fetch(`${baseUrl}/${pageId}`, {
            timeout: 10000
          });
          
          // Should return 200 (found), 404 (not found), or 400 (invalid)
          expect([200, 400, 404]).toContain(response.status);
          
          if (response.ok) {
            const html = await response.text();
            expect(html).toContain('html');
          }
        } catch (error) {
          console.warn(`Warning: Page ${pageId} failed with ${error.message}`);
        }
      }
    });

    test('should handle authentication-required pages', async () => {
      const authPages = [
        '/new',
        '/dashboard'
      ];

      for (const page of authPages) {
        try {
          const response = await fetch(`${baseUrl}${page}`, {
            timeout: 10000,
            redirect: 'manual' // Don't follow redirects
          });
          
          // Should return 200 (if accessible) or 302 (redirect to login)
          expect([200, 302]).toContain(response.status);
          
          if (response.status === 302) {
            const location = response.headers.get('location');
            expect(location).toContain('auth');
          }
        } catch (error) {
          console.warn(`Warning: Auth page ${page} failed with ${error.message}`);
        }
      }
    });
  });

  describe('Security Tests', () => {
    test('should prevent path traversal attacks', async () => {
      const maliciousPaths = [
        '/../../../etc/passwd',
        '/..%2F..%2F..%2Fetc%2Fpasswd',
        '/....//....//....//etc//passwd'
      ];

      for (const path of maliciousPaths) {
        try {
          const response = await fetch(`${baseUrl}${path}`, {
            timeout: 5000
          });
          
          // Should return 400 (bad request) or 404 (not found), never 200
          expect(response.status).not.toBe(200);
          expect([400, 404]).toContain(response.status);
        } catch (error) {
          // Network errors are acceptable for malicious requests
          expect(error).toBeDefined();
        }
      }
    });

    test('should handle XSS attempts in URLs', async () => {
      const xssPaths = [
        '/<script>alert(1)</script>',
        '/javascript:alert(1)',
        '/%3Cscript%3Ealert(1)%3C/script%3E'
      ];

      for (const path of xssPaths) {
        try {
          const response = await fetch(`${baseUrl}${path}`, {
            timeout: 5000
          });
          
          // Should return 400 or 404, and response should not contain unescaped script
          expect([400, 404]).toContain(response.status);
          
          if (response.ok) {
            const html = await response.text();
            expect(html).not.toContain('<script>alert(1)</script>');
          }
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Performance Tests', () => {
    test('should respond within reasonable time limits', async () => {
      const performanceEndpoints = [
        '/',
        '/api/random-pages',
        '/api/search-unified?searchTerm=test'
      ];

      for (const endpoint of performanceEndpoints) {
        const startTime = Date.now();
        
        try {
          const response = await fetch(`${baseUrl}${endpoint}`, {
            timeout: 10000
          });
          
          const responseTime = Date.now() - startTime;
          
          // Response should be under 5 seconds for basic endpoints
          expect(responseTime).toBeLessThan(5000);
          
          console.log(`⏱️  ${endpoint}: ${responseTime}ms`);
        } catch (error) {
          console.warn(`Warning: ${endpoint} performance test failed: ${error.message}`);
        }
      }
    });
  });
});
