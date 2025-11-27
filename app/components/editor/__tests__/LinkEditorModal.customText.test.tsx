/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LinkEditorModal from '../LinkEditorModal';

// Mock the auth provider
jest.mock('../../../providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { uid: 'test-user-id' }
  })
}));

// Mock the toast
jest.mock('../../ui/use-toast', () => ({
  toast: {
    error: jest.fn()
  }
}));

// Mock FilteredSearchResults
jest.mock('../../search/FilteredSearchResults', () => {
  return React.forwardRef(({ onSelect, placeholder }: any, ref: any) => (
    <div data-testid="filtered-search-results">
      <input 
        ref={ref}
        placeholder={placeholder}
        data-testid="search-input"
      />
      <button
        onClick={() => onSelect({
          id: 'test-page-id',
          title: 'Test Page Title',
          username: 'testuser',
          isNew: false
        })}
        data-testid="select-page-button"
      >
        Select Test Page
      </button>
    </div>
  ));
});

describe('LinkEditorModal Custom Text Functionality', () => {
  const mockOnClose = jest.fn();
  const mockOnInsertLink = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('New Link Creation', () => {
    test('should create link with page title when custom text is disabled', async () => {
      render(
        <LinkEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onInsertLink={mockOnInsertLink}
          selectedText=""
          linkedPageIds={[]}
        />
      );

      // Verify custom text toggle is off by default
      const customTextSwitch = screen.getByRole('switch', { name: /custom link text/i });
      expect(customTextSwitch).not.toBeChecked();

      // Select a page
      const selectPageButton = screen.getByTestId('select-page-button');
      fireEvent.click(selectPageButton);

      // Verify that onInsertLink was called with empty text (will use page title)
      await waitFor(() => {
        expect(mockOnInsertLink).toHaveBeenCalledWith(
          expect.objectContaining({
            pageTitle: 'Test Page Title',
            text: '', // Empty text means use page title
          })
        );
      });
    });

    test('should create link with custom text when custom text is enabled', async () => {
      render(
        <LinkEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onInsertLink={mockOnInsertLink}
          selectedText=""
          linkedPageIds={[]}
        />
      );

      // Enable custom text toggle
      const customTextSwitch = screen.getByRole('switch', { name: /custom link text/i });
      fireEvent.click(customTextSwitch);
      expect(customTextSwitch).toBeChecked();

      // Custom text input should appear
      const customTextInput = screen.getByDisplayValue('');
      expect(customTextInput).toBeInTheDocument();

      // Select a page
      const selectPageButton = screen.getByTestId('select-page-button');
      fireEvent.click(selectPageButton);

      // Enter custom text
      fireEvent.change(customTextInput, { target: { value: 'My Custom Link Text' } });

      // Click create button
      const createButton = screen.getByRole('button', { name: /create link/i });
      fireEvent.click(createButton);

      // Verify that onInsertLink was called with custom text
      await waitFor(() => {
        expect(mockOnInsertLink).toHaveBeenCalledWith(
          expect.objectContaining({
            pageTitle: 'Test Page Title',
            text: 'My Custom Link Text', // Custom text provided
          })
        );
      });
    });
  });

  describe('Editing Existing Links', () => {
    test('should pre-populate with current display text when editing link with custom text', () => {
      const editingLink = {
        element: {} as any,
        type: 'page' as const,
        data: {
          pageId: 'test-page-id',
          pageTitle: 'Test Page Title',
          title: 'Test Page Title',
          displayText: 'My Custom Display Text',
          isCustomText: true,
          customText: 'My Custom Display Text',
        }
      };

      render(
        <LinkEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onInsertLink={mockOnInsertLink}
          editingLink={editingLink}
          selectedText=""
          linkedPageIds={[]}
        />
      );

      // Custom text toggle should be enabled
      const customTextSwitch = screen.getByRole('switch', { name: /custom link text/i });
      expect(customTextSwitch).toBeChecked();

      // Custom text input should be visible and pre-filled
      const customTextInput = screen.getByDisplayValue('My Custom Display Text');
      expect(customTextInput).toBeInTheDocument();
      expect(customTextInput).toHaveValue('My Custom Display Text');
    });

    test('should pre-populate with page title when editing link without custom text', () => {
      const editingLink = {
        element: {} as any,
        type: 'page' as const,
        data: {
          pageId: 'test-page-id',
          pageTitle: 'Test Page Title',
          title: 'Test Page Title',
          displayText: 'Test Page Title',
          isCustomText: false,
        }
      };

      render(
        <LinkEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onInsertLink={mockOnInsertLink}
          editingLink={editingLink}
          selectedText=""
          linkedPageIds={[]}
        />
      );

      // Custom text toggle should be disabled
      const customTextSwitch = screen.getByRole('switch', { name: /custom link text/i });
      expect(customTextSwitch).not.toBeChecked();

      // Custom text input should not be visible
      expect(screen.queryByLabelText(/display text/i)).not.toBeInTheDocument();
    });

    test('should revert to page title when custom text is disabled', async () => {
      const editingLink = {
        element: {} as any,
        type: 'page' as const,
        data: {
          pageId: 'test-page-id',
          pageTitle: 'Test Page Title',
          title: 'Test Page Title',
          displayText: 'My Custom Display Text',
          isCustomText: true,
          customText: 'My Custom Display Text',
        }
      };

      render(
        <LinkEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onInsertLink={mockOnInsertLink}
          editingLink={editingLink}
          selectedText=""
          linkedPageIds={[]}
        />
      );

      // Custom text toggle should be enabled initially
      const customTextSwitch = screen.getByRole('switch', { name: /custom link text/i });
      expect(customTextSwitch).toBeChecked();

      // Disable custom text toggle
      fireEvent.click(customTextSwitch);
      expect(customTextSwitch).not.toBeChecked();

      // Custom text input should disappear
      expect(screen.queryByDisplayValue('My Custom Display Text')).not.toBeInTheDocument();

      // Click save button
      const saveButton = screen.getByRole('button', { name: /create link|save/i });
      fireEvent.click(saveButton);

      // Verify that onInsertLink was called with empty text (will revert to page title)
      await waitFor(() => {
        expect(mockOnInsertLink).toHaveBeenCalledWith(
          expect.objectContaining({
            pageTitle: 'Test Page Title',
            text: '', // Empty text means revert to page title
          })
        );
      });
    });
  });

  describe('External Links', () => {
    test('should handle custom text for external links', async () => {
      render(
        <LinkEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onInsertLink={mockOnInsertLink}
          selectedText=""
          linkedPageIds={[]}
        />
      );

      // Switch to external tab
      const externalTab = screen.getByRole('button', { name: /external/i });
      fireEvent.click(externalTab);

      // Enter URL
      const urlInput = screen.getByLabelText(/url/i);
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } });

      // Enable custom text
      const customTextSwitch = screen.getByRole('switch', { name: /custom link text/i });
      fireEvent.click(customTextSwitch);

      // Enter custom text
      const customTextInput = screen.getByPlaceholderText(/enter custom display text/i);
      fireEvent.change(customTextInput, { target: { value: 'Example Website' } });

      // Click create button
      const createButton = screen.getByRole('button', { name: /create link/i });
      fireEvent.click(createButton);

      // Verify external link with custom text
      await waitFor(() => {
        expect(mockOnInsertLink).toHaveBeenCalledWith(
          expect.objectContaining({
            url: 'https://example.com',
            text: 'Example Website',
            isExternal: true,
          })
        );
      });
    });
  });
});
