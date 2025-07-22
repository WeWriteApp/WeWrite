/**
 * useInfiniteScroll Hook Tests
 * 
 * Tests the infinite scroll hook functionality including:
 * - Intersection Observer setup
 * - Load more callback triggering
 * - Proper cleanup
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
});

// @ts-ignore
window.IntersectionObserver = mockIntersectionObserver;

// Test component that uses the hook
function TestComponent({ onLoadMore }: { onLoadMore: () => void }) {
  const { targetRef } = useInfiniteScroll(onLoadMore);
  
  return (
    <div>
      <div>Content</div>
      <div ref={targetRef} data-testid="scroll-target">
        Scroll Target
      </div>
    </div>
  );
}

describe('useInfiniteScroll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create IntersectionObserver on mount', () => {
    const mockOnLoadMore = jest.fn();
    
    render(<TestComponent onLoadMore={mockOnLoadMore} />);
    
    expect(mockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        rootMargin: '200px',
        threshold: 0.1
      })
    );
  });

  test('should observe the target element', () => {
    const mockOnLoadMore = jest.fn();
    const mockObserve = jest.fn();
    
    mockIntersectionObserver.mockReturnValue({
      observe: mockObserve,
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    });
    
    render(<TestComponent onLoadMore={mockOnLoadMore} />);
    
    expect(mockObserve).toHaveBeenCalled();
  });

  test('should call onLoadMore when intersection occurs', () => {
    const mockOnLoadMore = jest.fn();
    let intersectionCallback: (entries: any[]) => void;
    
    mockIntersectionObserver.mockImplementation((callback) => {
      intersectionCallback = callback;
      return {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      };
    });
    
    render(<TestComponent onLoadMore={mockOnLoadMore} />);
    
    // Simulate intersection
    intersectionCallback([{ isIntersecting: true }]);
    
    expect(mockOnLoadMore).toHaveBeenCalledTimes(1);
  });

  test('should not call onLoadMore when not intersecting', () => {
    const mockOnLoadMore = jest.fn();
    let intersectionCallback: (entries: any[]) => void;
    
    mockIntersectionObserver.mockImplementation((callback) => {
      intersectionCallback = callback;
      return {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      };
    });
    
    render(<TestComponent onLoadMore={mockOnLoadMore} />);
    
    // Simulate no intersection
    intersectionCallback([{ isIntersecting: false }]);
    
    expect(mockOnLoadMore).not.toHaveBeenCalled();
  });

  test('should disconnect observer on unmount', () => {
    const mockOnLoadMore = jest.fn();
    const mockDisconnect = jest.fn();
    
    mockIntersectionObserver.mockReturnValue({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: mockDisconnect,
    });
    
    const { unmount } = render(<TestComponent onLoadMore={mockOnLoadMore} />);
    
    unmount();
    
    expect(mockDisconnect).toHaveBeenCalled();
  });

  test('should handle custom threshold options', () => {
    const mockOnLoadMore = jest.fn();
    
    function TestComponentWithOptions() {
      const { targetRef } = useInfiniteScroll(mockOnLoadMore, { threshold: 500 });
      return <div ref={targetRef} data-testid="scroll-target">Target</div>;
    }
    
    render(<TestComponentWithOptions />);
    
    expect(mockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        rootMargin: '500px',
        threshold: 0.1
      })
    );
  });

  test('should render target element correctly', () => {
    const mockOnLoadMore = jest.fn();
    
    render(<TestComponent onLoadMore={mockOnLoadMore} />);
    
    const target = screen.getByTestId('scroll-target');
    expect(target).toBeTruthy();
    expect(target.textContent).toBe('Scroll Target');
  });
});
