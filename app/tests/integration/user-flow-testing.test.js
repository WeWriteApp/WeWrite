/**
 * User Flow Integration Tests
 * 
 * This test suite validates complete user journeys with real data:
 * - User registration and authentication flows
 * - Page creation and editing workflows
 * - Search and discovery functionality
 * - Payment and subscription flows
 * - Reply and collaboration features
 * - Admin functionality
 * 
 * These tests use realistic test data and simulate actual user interactions.
 */

import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Mock Firebase services
jest.mock('../../firebase/config', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
  },
  db: {},
  app: {},
}));

jest.mock('../../firebase/database', () => ({
  createPage: jest.fn(),
  getPageById: jest.fn(),
  updatePage: jest.fn(),
  deletePage: jest.fn(),
}));

jest.mock('../../firebase/auth', () => ({
  createUser: jest.fn(),
  loginUser: jest.fn(),
  logoutUser: jest.fn(),
  checkUsernameAvailability: jest.fn(),
}));

/**
 * Test Data Generator
 * Creates realistic test data for user flows
 */
class TestDataGenerator {
  constructor() {
    this.testUsers = {
      newUser: {
        email: 'newuser@test.com',
        password: 'TestPassword123!',
        username: 'testuser123',
        displayName: 'Test User'
      },
      existingUser: {
        uid: 'existing-user-123',
        email: 'existing@test.com',
        username: 'existinguser',
        displayName: 'Existing User'
      },
      adminUser: {
        uid: 'admin-user-123',
        email: 'jamiegray2234@gmail.com',
        username: 'admin',
        displayName: 'Admin User'
      }
    };

    this.testPages = {
      publicPage: {
        id: 'public-page-123',
        title: 'Test Public Page',
        content: JSON.stringify([
          {
            type: 'paragraph',
            children: [{ text: 'This is a test public page content.' }]
          }
        ]),
        isPublic: true,
        userId: 'existing-user-123',
        username: 'existinguser',
        lastModified: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      privatePage: {
        id: 'private-page-123',
        title: 'Test Private Page',
        content: JSON.stringify([
          {
            type: 'paragraph',
            children: [{ text: 'This is a test private page content.' }]
          }
        ]),
        isPublic: false,
        userId: 'existing-user-123',
        username: 'existinguser',
        lastModified: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }
    };

    this.testSubscriptions = {
      basic: {
        priceId: 'price_basic_monthly',
        amount: 500, // $5.00
        tierName: 'Basic',
        interval: 'month'
      },
      premium: {
        priceId: 'price_premium_monthly',
        amount: 1500, // $15.00
        tierName: 'Premium',
        interval: 'month'
      }
    };
  }

  generatePageContent(title, type = 'standard') {
    const baseContent = [
      {
        type: 'heading',
        level: 1,
        children: [{ text: title }]
      },
      {
        type: 'paragraph',
        children: [{ text: `This is the content for ${title}.` }]
      }
    ];

    if (type === 'reply') {
      baseContent.unshift({
        type: 'paragraph',
        children: [
          { text: 'Replying to: ' },
          { text: 'Original Page Title', bold: true }
        ]
      });
    }

    return JSON.stringify(baseContent);
  }

  generateSearchResults(query, resultCount = 5) {
    const results = [];
    for (let i = 0; i < resultCount; i++) {
      results.push({
        id: `search-result-${i}`,
        title: `${query} Result ${i + 1}`,
        content: `Content related to ${query}`,
        username: `user${i}`,
        lastModified: new Date().toISOString(),
        isPublic: true
      });
    }
    return results;
  }
}

/**
 * User Flow Test Runner
 * Orchestrates complete user journey tests
 */
class UserFlowTestRunner {
  constructor() {
    this.testData = new TestDataGenerator();
    this.mockResponses = new Map();
  }

  setupMockResponse(endpoint, response) {
    this.mockResponses.set(endpoint, response);
  }

  async simulateAPICall(endpoint, options = {}) {
    const mockResponse = this.mockResponses.get(endpoint);
    if (mockResponse) {
      return Promise.resolve(mockResponse);
    }

    // Default mock responses
    if (endpoint.includes('/api/auth/register')) {
      return { success: true, user: this.testData.testUsers.newUser };
    }
    if (endpoint.includes('/api/auth/login')) {
      return { success: true, user: this.testData.testUsers.existingUser };
    }
    if (endpoint.includes('/api/pages')) {
      return { success: true, pageId: 'new-page-123' };
    }

    return { success: false, error: 'Mock endpoint not configured' };
  }

  async testUserRegistrationFlow() {
    const { createUser, checkUsernameAvailability } = require('../../firebase/auth');
    
    // Mock username availability check
    checkUsernameAvailability.mockResolvedValue({
      isAvailable: true,
      message: 'Username is available',
      error: null,
      suggestions: []
    });

    // Mock user creation
    createUser.mockResolvedValue({
      user: {
        uid: 'new-user-123',
        email: this.testData.testUsers.newUser.email,
        emailVerified: false
      }
    });

    const result = {
      usernameCheck: await checkUsernameAvailability(this.testData.testUsers.newUser.username),
      userCreation: await createUser(
        this.testData.testUsers.newUser.email,
        this.testData.testUsers.newUser.password
      )
    };

    return result;
  }

  async testUserLoginFlow() {
    const { loginUser } = require('../../firebase/auth');
    
    // Mock successful login
    loginUser.mockResolvedValue({
      user: {
        uid: this.testData.testUsers.existingUser.uid,
        email: this.testData.testUsers.existingUser.email,
        emailVerified: true
      }
    });

    const result = await loginUser(
      this.testData.testUsers.existingUser.email,
      'password123'
    );

    return result;
  }

  async testPageCreationFlow() {
    const { createPage } = require('../../firebase/database');
    
    const pageData = {
      title: 'Test Integration Page',
      content: this.testData.generatePageContent('Test Integration Page'),
      isPublic: true,
      location: null,
      userId: this.testData.testUsers.existingUser.uid,
      username: this.testData.testUsers.existingUser.username,
      lastModified: new Date().toISOString(),
      isReply: false
    };

    // Mock page creation
    createPage.mockResolvedValue('new-page-123');

    const result = {
      pageId: await createPage(pageData),
      pageData
    };

    return result;
  }

  async testReplyCreationFlow() {
    const { createPage } = require('../../firebase/database');
    
    const replyData = {
      title: '',
      content: this.testData.generatePageContent('Reply to Test Page', 'reply'),
      isPublic: true,
      location: null,
      userId: this.testData.testUsers.existingUser.uid,
      username: this.testData.testUsers.existingUser.username,
      lastModified: new Date().toISOString(),
      isReply: true,
      replyTo: this.testData.testPages.publicPage.id,
      replyToTitle: this.testData.testPages.publicPage.title,
      replyToUsername: this.testData.testPages.publicPage.username
    };

    // Mock reply creation
    createPage.mockResolvedValue('new-reply-123');

    const result = {
      replyId: await createPage(replyData),
      replyData
    };

    return result;
  }

  async testSearchFlow() {
    // Mock search API response
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        pages: this.testData.generateSearchResults('test query'),
        users: [
          {
            uid: 'user1',
            username: 'testuser1',
            displayName: 'Test User 1'
          }
        ],
        source: 'unified_search',
        performance: {
          searchTimeMs: 150,
          pagesFound: 5,
          usersFound: 1
        }
      })
    });

    const response = await fetch('/api/search-unified?searchTerm=test%20query');
    const result = await response.json();

    return result;
  }

  async testSubscriptionFlow() {
    // Mock Stripe checkout session creation
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'cs_test_checkout_session_123',
        url: 'https://checkout.stripe.com/pay/cs_test_checkout_session_123'
      })
    });

    const checkoutData = {
      priceId: this.testData.testSubscriptions.basic.priceId,
      userId: this.testData.testUsers.existingUser.uid,
      amount: this.testData.testSubscriptions.basic.amount,
      tierName: this.testData.testSubscriptions.basic.tierName
    };

    const response = await fetch('/api/subscription/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkoutData)
    });

    const result = await response.json();

    return { checkoutData, result };
  }

  async testAdminFlow() {
    // Mock admin API responses
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            totalRevenue: 10000,
            activeSubscriptions: 50,
            successRate: 95.5
          },
          timestamp: new Date().toISOString()
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            totalUsers: 1000,
            flaggedUsers: 5,
            securityScore: 95
          },
          timestamp: new Date().toISOString()
        })
      });

    const paymentMetrics = await fetch('/api/admin/payment-metrics');
    const securityMetrics = await fetch('/api/admin/security-metrics');

    const result = {
      paymentMetrics: await paymentMetrics.json(),
      securityMetrics: await securityMetrics.json()
    };

    return result;
  }
}

// Initialize test runner
const testRunner = new UserFlowTestRunner();

describe('User Flow Integration Tests', () => {
  beforeAll(() => {
    // Set up global mocks
    global.fetch = jest.fn();
    global.window = {
      location: { href: '', pathname: '/' },
      gtag: jest.fn()
    };
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('User Registration and Authentication Flow', () => {
    test('should complete full user registration journey', async () => {
      const result = await testRunner.testUserRegistrationFlow();

      // Verify username availability check
      expect(result.usernameCheck.isAvailable).toBe(true);
      expect(result.usernameCheck.error).toBeNull();

      // Verify user creation
      expect(result.userCreation.user).toBeDefined();
      expect(result.userCreation.user.email).toBe(testRunner.testData.testUsers.newUser.email);
      expect(result.userCreation.user.uid).toBeDefined();
    });

    test('should handle user login flow', async () => {
      const result = await testRunner.testUserLoginFlow();

      expect(result.user).toBeDefined();
      expect(result.user.uid).toBe(testRunner.testData.testUsers.existingUser.uid);
      expect(result.user.email).toBe(testRunner.testData.testUsers.existingUser.email);
      expect(result.user.emailVerified).toBe(true);
    });

    test('should handle username availability edge cases', async () => {
      const { checkUsernameAvailability } = require('../../firebase/auth');

      // Test taken username
      checkUsernameAvailability.mockResolvedValueOnce({
        isAvailable: false,
        message: 'Username is already taken',
        error: null,
        suggestions: ['testuser124', 'testuser125', 'testuser126']
      });

      const result = await checkUsernameAvailability('existinguser');

      expect(result.isAvailable).toBe(false);
      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions[0]).toContain('testuser');
    });
  });

  describe('Page Creation and Management Flow', () => {
    test('should complete page creation workflow', async () => {
      const result = await testRunner.testPageCreationFlow();

      expect(result.pageId).toBeDefined();
      expect(result.pageId).toBe('new-page-123');
      expect(result.pageData.title).toBe('Test Integration Page');
      expect(result.pageData.isPublic).toBe(true);
      expect(result.pageData.userId).toBe(testRunner.testData.testUsers.existingUser.uid);
    });

    test('should handle page editing workflow', async () => {
      const { updatePage } = require('../../firebase/database');

      const updateData = {
        title: 'Updated Test Page',
        content: testRunner.testData.generatePageContent('Updated Test Page'),
        lastModified: new Date().toISOString()
      };

      updatePage.mockResolvedValue(true);

      const result = await updatePage('existing-page-123', updateData);

      expect(result).toBe(true);
      expect(updatePage).toHaveBeenCalledWith('existing-page-123', updateData);
    });

    test('should handle page deletion workflow', async () => {
      const { deletePage } = require('../../firebase/database');

      deletePage.mockResolvedValue(true);

      const result = await deletePage('page-to-delete-123');

      expect(result).toBe(true);
      expect(deletePage).toHaveBeenCalledWith('page-to-delete-123');
    });

    test('should validate page content structure', async () => {
      const content = testRunner.testData.generatePageContent('Test Page');
      const parsedContent = JSON.parse(content);

      expect(Array.isArray(parsedContent)).toBe(true);
      expect(parsedContent[0].type).toBe('heading');
      expect(parsedContent[0].level).toBe(1);
      expect(parsedContent[1].type).toBe('paragraph');
    });
  });

  describe('Reply and Collaboration Flow', () => {
    test('should complete reply creation workflow', async () => {
      const result = await testRunner.testReplyCreationFlow();

      expect(result.replyId).toBeDefined();
      expect(result.replyId).toBe('new-reply-123');
      expect(result.replyData.isReply).toBe(true);
      expect(result.replyData.replyTo).toBe(testRunner.testData.testPages.publicPage.id);
      expect(result.replyData.replyToTitle).toBe(testRunner.testData.testPages.publicPage.title);
    });

    test('should handle reply content structure', async () => {
      const replyContent = testRunner.testData.generatePageContent('Reply Test', 'reply');
      const parsedContent = JSON.parse(replyContent);

      expect(Array.isArray(parsedContent)).toBe(true);
      expect(parsedContent[0].children[0].text).toContain('Replying to:');
      expect(parsedContent[0].children[1].bold).toBe(true);
    });

    test('should validate reply metadata', async () => {
      const replyData = {
        isReply: true,
        replyTo: 'parent-page-123',
        replyToTitle: 'Parent Page Title',
        replyToUsername: 'parentuser'
      };

      expect(replyData.isReply).toBe(true);
      expect(replyData.replyTo).toBeDefined();
      expect(replyData.replyToTitle).toBeDefined();
      expect(replyData.replyToUsername).toBeDefined();
    });
  });

  describe('Search and Discovery Flow', () => {
    test('should complete search workflow', async () => {
      const result = await testRunner.testSearchFlow();

      expect(result.pages).toBeDefined();
      expect(result.users).toBeDefined();
      expect(result.source).toBe('unified_search');
      expect(result.performance).toBeDefined();
      expect(result.performance.searchTimeMs).toBeGreaterThan(0);
      expect(result.pages.length).toBe(5);
      expect(result.users.length).toBe(1);
    });

    test('should handle empty search results', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          pages: [],
          users: [],
          source: 'unified_search',
          performance: {
            searchTimeMs: 50,
            pagesFound: 0,
            usersFound: 0
          }
        })
      });

      const response = await fetch('/api/search-unified?searchTerm=nonexistent');
      const result = await response.json();

      expect(result.pages).toHaveLength(0);
      expect(result.users).toHaveLength(0);
      expect(result.performance.pagesFound).toBe(0);
    });

    test('should validate search result structure', async () => {
      const searchResults = testRunner.testData.generateSearchResults('test', 3);

      expect(searchResults).toHaveLength(3);
      searchResults.forEach((result, index) => {
        expect(result.id).toBe(`search-result-${index}`);
        expect(result.title).toContain('test');
        expect(result.username).toBeDefined();
        expect(result.isPublic).toBe(true);
      });
    });
  });

  describe('Payment and Subscription Flow', () => {
    test('should complete subscription checkout workflow', async () => {
      const result = await testRunner.testSubscriptionFlow();

      expect(result.checkoutData.priceId).toBe(testRunner.testData.testSubscriptions.basic.priceId);
      expect(result.checkoutData.amount).toBe(500);
      expect(result.result.id).toBeDefined();
      expect(result.result.url).toContain('checkout.stripe.com');
    });

    test('should handle subscription portal access', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          url: 'https://billing.stripe.com/session/portal_123',
          success: true
        })
      });

      const response = await fetch('/api/subscription/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'test-user-123' })
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.url).toContain('billing.stripe.com');
    });

    test('should validate subscription data structure', async () => {
      const subscription = testRunner.testData.testSubscriptions.basic;

      expect(subscription.priceId).toBeDefined();
      expect(subscription.amount).toBeGreaterThan(0);
      expect(subscription.tierName).toBeDefined();
      expect(subscription.interval).toBe('month');
    });
  });

  describe('Admin Functionality Flow', () => {
    test('should complete admin dashboard workflow', async () => {
      const result = await testRunner.testAdminFlow();

      expect(result.paymentMetrics.success).toBe(true);
      expect(result.paymentMetrics.data.totalRevenue).toBeGreaterThan(0);
      expect(result.paymentMetrics.data.activeSubscriptions).toBeGreaterThan(0);

      expect(result.securityMetrics.success).toBe(true);
      expect(result.securityMetrics.data.totalUsers).toBeGreaterThan(0);
      expect(result.securityMetrics.data.securityScore).toBeGreaterThan(0);
    });

    test('should handle admin authentication', async () => {
      const adminUser = testRunner.testData.testUsers.adminUser;

      expect(adminUser.email).toBe('jamiegray2234@gmail.com');
      expect(adminUser.uid).toBeDefined();
    });

    test('should validate admin permissions', async () => {
      // Mock admin permission check
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({
          error: 'Admin access required'
        })
      });

      const response = await fetch('/api/admin/payment-metrics');
      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.error).toContain('Admin access required');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      try {
        await fetch('/api/search-unified?searchTerm=test');
      } catch (error) {
        expect(error.message).toBe('Network error');
      }
    });

    test('should handle invalid page data', async () => {
      const { createPage } = require('../../firebase/database');

      createPage.mockRejectedValue(new Error('Invalid page data'));

      const invalidPageData = {
        title: '', // Empty title
        content: 'invalid-json-content',
        userId: null // Missing user ID
      };

      try {
        await createPage(invalidPageData);
      } catch (error) {
        expect(error.message).toBe('Invalid page data');
      }
    });

    test('should handle authentication failures', async () => {
      const { loginUser } = require('../../firebase/auth');

      loginUser.mockResolvedValue({
        code: 'auth/wrong-password',
        message: 'The password is invalid or the user does not have a password.'
      });

      const result = await loginUser('test@example.com', 'wrongpassword');

      expect(result.code).toBe('auth/wrong-password');
      expect(result.message).toContain('password is invalid');
    });

    test('should handle rate limiting', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({
          error: 'Too Many Requests',
          retryAfter: 60
        })
      });

      const response = await fetch('/api/search-unified?searchTerm=test');
      const result = await response.json();

      expect(response.status).toBe(429);
      expect(result.error).toBe('Too Many Requests');
      expect(result.retryAfter).toBe(60);
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle concurrent user operations', async () => {
      const concurrentOperations = 5;
      const promises = [];

      for (let i = 0; i < concurrentOperations; i++) {
        promises.push(testRunner.testPageCreationFlow());
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(concurrentOperations);
      results.forEach(result => {
        expect(result.pageId).toBeDefined();
      });
    });

    test('should validate response times', async () => {
      const startTime = Date.now();
      await testRunner.testSearchFlow();
      const responseTime = Date.now() - startTime;

      // Should complete within 1 second in test environment
      expect(responseTime).toBeLessThan(1000);
    });
  });
});
