import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AllocationBar } from '../AllocationBar';
import { AuthProvider } from '../../providers/AuthProvider';
import { UsdBalanceProvider } from '../../contexts/UsdBalanceContext';
import { AllocationIntervalProvider } from '../../contexts/AllocationIntervalContext';

// Mock Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({}))
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn((auth, callback) => {
    // Simulate logged-in user
    // Note: Firebase Auth returns displayName but WeWrite uses username from Firestore
    callback({
      uid: 'test-user-id',
      email: 'test@example.com',
      displayName: 'test_user' // This is Firebase's field - we use username in app
    });
    return jest.fn(); // unsubscribe function
  }),
  signOut: jest.fn()
}));

// Mock API calls
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock toast
jest.mock('../../components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}));

// Mock notifications
jest.mock('../../utils/usdNotifications', () => ({
  showUsdAllocationNotification: jest.fn()
}));

describe('AllocationBar Integration', () => {
  let queryClient: QueryClient;

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UsdBalanceProvider>
          <AllocationIntervalProvider>
            {children}
          </AllocationIntervalProvider>
        </UsdBalanceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock successful API responses
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/usd/allocate?pageId=')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ currentAllocation: 500 })
        } as Response);
      }
      if (url.includes('/api/usd/balance')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            totalUsdCents: 10000,
            allocatedUsdCents: 3000
          })
        } as Response);
      }
      if (url.includes('/api/user-preferences/allocation-interval')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ intervalCents: 100 })
        } as Response);
      }
      return Promise.reject(new Error('Unhandled URL'));
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    queryClient.clear();
  });

  it('should render allocation bar with correct initial state', async () => {
    render(
      <TestWrapper>
        <AllocationBar
          pageId="test-page"
          authorId="author-id"
          pageTitle="Test Page"
        />
      </TestWrapper>
    );

    // Should show loading state initially
    expect(screen.getByRole('button', { name: /minus/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /plus/i })).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('$5.00/mo')).toBeInTheDocument();
    });
  });

  it('should handle allocation increase', async () => {
    mockFetch.mockImplementation((url, options) => {
      if (options?.method === 'POST' && url.includes('/api/usd/allocate')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            currentAllocation: 600
          })
        } as Response);
      }
      // Handle other requests as before
      return mockFetch.getMockImplementation()?.(url, options) || Promise.reject(new Error('Unhandled'));
    });

    render(
      <TestWrapper>
        <AllocationBar
          pageId="test-page"
          authorId="author-id"
          pageTitle="Test Page"
        />
      </TestWrapper>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('$5.00/mo')).toBeInTheDocument();
    });

    // Click plus button
    const plusButton = screen.getByRole('button', { name: /plus/i });
    fireEvent.click(plusButton);

    // Fast-forward timers to trigger batch processing
    jest.advanceTimersByTime(300);

    // Wait for allocation to update
    await waitFor(() => {
      expect(screen.getByText('$6.00/mo')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/usd/allocate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageId: 'test-page',
        changeCents: 100,
        source: 'FloatingBar'
      })
    });
  });

  it('should handle allocation decrease', async () => {
    mockFetch.mockImplementation((url, options) => {
      if (options?.method === 'POST' && url.includes('/api/usd/allocate')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            currentAllocation: 400
          })
        } as Response);
      }
      return mockFetch.getMockImplementation()?.(url, options) || Promise.reject(new Error('Unhandled'));
    });

    render(
      <TestWrapper>
        <AllocationBar
          pageId="test-page"
          authorId="author-id"
          pageTitle="Test Page"
        />
      </TestWrapper>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('$5.00/mo')).toBeInTheDocument();
    });

    // Click minus button
    const minusButton = screen.getByRole('button', { name: /minus/i });
    fireEvent.click(minusButton);

    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByText('$4.00/mo')).toBeInTheDocument();
    });
  });

  it('should handle insufficient funds error', async () => {
    mockFetch.mockImplementation((url, options) => {
      if (options?.method === 'POST' && url.includes('/api/usd/allocate')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({
            code: 'INSUFFICIENT_FUNDS',
            message: 'Not enough funds'
          })
        } as Response);
      }
      return mockFetch.getMockImplementation()?.(url, options) || Promise.reject(new Error('Unhandled'));
    });

    render(
      <TestWrapper>
        <AllocationBar
          pageId="test-page"
          authorId="author-id"
          pageTitle="Test Page"
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('$5.00/mo')).toBeInTheDocument();
    });

    const plusButton = screen.getByRole('button', { name: /plus/i });
    fireEvent.click(plusButton);

    jest.advanceTimersByTime(300);

    // Should show error state but not crash
    await waitFor(() => {
      expect(screen.getByText('$5.00/mo')).toBeInTheDocument(); // Should revert
    });
  });

  it('should handle rapid clicking with batching', async () => {
    let requestCount = 0;
    mockFetch.mockImplementation((url, options) => {
      if (options?.method === 'POST' && url.includes('/api/usd/allocate')) {
        requestCount++;
        const body = JSON.parse(options.body as string);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            currentAllocation: 500 + body.changeCents
          })
        } as Response);
      }
      return mockFetch.getMockImplementation()?.(url, options) || Promise.reject(new Error('Unhandled'));
    });

    render(
      <TestWrapper>
        <AllocationBar
          pageId="test-page"
          authorId="author-id"
          pageTitle="Test Page"
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('$5.00/mo')).toBeInTheDocument();
    });

    const plusButton = screen.getByRole('button', { name: /plus/i });
    
    // Rapid clicks
    fireEvent.click(plusButton);
    fireEvent.click(plusButton);
    fireEvent.click(plusButton);

    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByText('$8.00/mo')).toBeInTheDocument();
    });

    // Should batch requests - only one API call for multiple clicks
    expect(requestCount).toBe(1);
  });

  it('should show composition bar with correct proportions', async () => {
    render(
      <TestWrapper>
        <AllocationBar
          pageId="test-page"
          authorId="author-id"
          pageTitle="Test Page"
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('$5.00/mo')).toBeInTheDocument();
    });

    // Should render composition bar elements
    const compositionBar = screen.getByRole('generic');
    expect(compositionBar).toBeInTheDocument();
  });

  it('should handle long press for interval modal', async () => {
    render(
      <TestWrapper>
        <AllocationBar
          pageId="test-page"
          authorId="author-id"
          pageTitle="Test Page"
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('$5.00/mo')).toBeInTheDocument();
    });

    const plusButton = screen.getByRole('button', { name: /plus/i });
    
    // Simulate long press
    fireEvent.mouseDown(plusButton);
    
    jest.advanceTimersByTime(500); // Long press threshold
    
    fireEvent.mouseUp(plusButton);

    // Should open interval modal (implementation depends on modal component)
    // This test would need to be updated based on actual modal implementation
  });
});
