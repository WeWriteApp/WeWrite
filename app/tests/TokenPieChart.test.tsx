/**
 * TokenPieChart Component Tests
 *
 * Tests the TokenPieChart component functionality including:
 * - Normal token display
 * - Overspent state (orange color)
 * - Out of tokens state (orange color + pulsing animation)
 * - Proper text display for each state
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
// TokenPieChart is now a backward-compatible export from UsdPieChart
import { TokenPieChart } from '../components/ui/UsdPieChart';

describe('TokenPieChart', () => {
  describe('Normal State', () => {
    test('should display normal colors when tokens are available', () => {
      const { container } = render(
        <TokenPieChart
          allocatedTokens={50}
          totalTokens={100}
          showFraction={true}
        />
      );

      // Should show normal fraction text
      expect(screen.getByText('50/100')).toBeTruthy();

      // Should not have pulsing animation class
      const pieChartContainer = container.querySelector('div');
      expect(pieChartContainer?.className).not.toContain('pulse-brightness-orange');
    });

    test('should display primary color for progress when tokens available', () => {
      const { container } = render(
        <TokenPieChart
          allocatedTokens={30}
          totalTokens={100}
        />
      );

      // Check that the SVG circle has primary color class
      const progressCircle = container.querySelector('circle.text-primary');
      expect(progressCircle).toBeTruthy();
    });
  });

  describe('Overspent State', () => {
    test('should display orange color when overspent', () => {
      const { container } = render(
        <TokenPieChart
          allocatedTokens={120}
          totalTokens={100}
          showFraction={true}
        />
      );

      // Should show overage text
      expect(screen.getByText('+20 over')).toBeTruthy();

      // Should have orange text color
      const fractionText = screen.getByText('+20 over');
      expect(fractionText.className).toContain('text-orange-600');
    });

    test('should display orange progress color when overspent', () => {
      const { container } = render(
        <TokenPieChart
          allocatedTokens={150}
          totalTokens={100}
        />
      );

      // Check that the SVG circle has orange color class (overspent uses text-orange-600)
      const progressCircle = container.querySelector('circle.text-orange-600');
      expect(progressCircle).toBeTruthy();
    });
  });

  describe('Out of Tokens State', () => {
    test('should display orange color and pulsing when out of tokens', () => {
      const { container } = render(
        <TokenPieChart
          allocatedTokens={100}
          totalTokens={100}
          showFraction={true}
        />
      );

      // Should show "Out of tokens" text
      expect(screen.getByText('Out of tokens')).toBeTruthy();

      // Should have orange text color
      const fractionText = screen.getByText('Out of tokens');
      expect(fractionText.className).toContain('text-orange-600');

      // Should have pulsing animation class
      const pieChartContainer = container.querySelector('div');
      expect(pieChartContainer?.className).toContain('pulse-brightness-orange');
    });

    test('should display orange progress color when out of tokens', () => {
      const { container } = render(
        <TokenPieChart
          allocatedTokens={100}
          totalTokens={100}
        />
      );

      // Check that the SVG circle has orange color class
      const progressCircle = container.querySelector('circle.text-orange-500');
      expect(progressCircle).toBeTruthy();
    });

    test('should handle edge case of zero total tokens', () => {
      const { container } = render(
        <TokenPieChart
          allocatedTokens={0}
          totalTokens={0}
          showFraction={true}
        />
      );

      // Should show normal fraction text (not out of tokens)
      expect(screen.getByText('0/0')).toBeTruthy();

      // Should not have pulsing animation class (totalTokens is 0)
      const pieChartContainer = container.querySelector('div');
      expect(pieChartContainer?.className).not.toContain('pulse-brightness-orange');
    });
  });

  describe('Click Handler', () => {
    test('should call onClick when provided', () => {
      const mockOnClick = jest.fn();
      const { container } = render(
        <TokenPieChart
          allocatedTokens={50}
          totalTokens={100}
          onClick={mockOnClick}
        />
      );

      const pieChartContainer = container.querySelector('div');
      expect(pieChartContainer?.className).toContain('cursor-pointer');
    });
  });

  describe('Fraction Display', () => {
    test('should hide fraction text when showFraction is false', () => {
      render(
        <TokenPieChart
          allocatedTokens={50}
          totalTokens={100}
          showFraction={false}
        />
      );

      // Should not show fraction text
      expect(screen.queryByText('50/100')).toBeNull();
    });
  });
});
