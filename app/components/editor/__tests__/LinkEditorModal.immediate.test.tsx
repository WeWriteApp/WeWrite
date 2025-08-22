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
          title: 'Test Page',
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

describe('LinkEditorModal Immediate Link Creation', () => {
  const mockOnClose = jest.fn();
  const mockOnInsertLink = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create link immediately when page is selected and custom text is disabled', async () => {
    render(
      <LinkEditorModal
        isOpen={true}
        onClose={mockOnClose}
        onInsertLink={mockOnInsertLink}
        selectedText=""
        linkedPageIds={[]}
      />
    );

    // Verify the modal is open
    expect(screen.getByText('Insert Link')).toBeInTheDocument();

    // Verify custom text toggle is off by default
    const customTextSwitch = screen.getByRole('switch', { name: /custom link text/i });
    expect(customTextSwitch).not.toBeChecked();

    // Verify helper text is shown
    expect(screen.getByText('Click on a page to create link immediately')).toBeInTheDocument();

    // Click on a page in the search results
    const selectPageButton = screen.getByTestId('select-page-button');
    fireEvent.click(selectPageButton);

    // Verify that onInsertLink was called immediately
    await waitFor(() => {
      expect(mockOnInsertLink).toHaveBeenCalledWith({
        type: 'page',
        pageId: 'test-page-id',
        pageTitle: 'Test Page',
        text: '',
        showAuthor: false,
        authorUsername: 'testuser',
        isEditing: false,
        element: undefined,
        isNew: false
      });
    });

    // Verify that the modal was closed
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should not create link immediately when custom text is enabled', async () => {
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

    // Verify helper text is not shown when custom text is enabled
    expect(screen.queryByText('Click on a page to create link immediately')).not.toBeInTheDocument();

    // Click on a page in the search results
    const selectPageButton = screen.getByTestId('select-page-button');
    fireEvent.click(selectPageButton);

    // Verify that onInsertLink was NOT called immediately
    expect(mockOnInsertLink).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();

    // Verify that the Save button is now visible
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  test('should show X button in top right corner', () => {
    render(
      <LinkEditorModal
        isOpen={true}
        onClose={mockOnClose}
        onInsertLink={mockOnInsertLink}
        selectedText=""
        linkedPageIds={[]}
      />
    );

    // Verify X button is present
    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toBeInTheDocument();

    // Click the X button
    fireEvent.click(closeButton);

    // Verify onClose was called
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should not show cancel button', () => {
    render(
      <LinkEditorModal
        isOpen={true}
        onClose={mockOnClose}
        onInsertLink={mockOnInsertLink}
        selectedText=""
        linkedPageIds={[]}
      />
    );

    // Verify cancel button is not present
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });

  test('should show save button only when custom text is enabled', () => {
    render(
      <LinkEditorModal
        isOpen={true}
        onClose={mockOnClose}
        onInsertLink={mockOnInsertLink}
        selectedText=""
        linkedPageIds={[]}
      />
    );

    // Initially, save button should not be visible
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();

    // Enable custom text toggle
    const customTextSwitch = screen.getByRole('switch', { name: /custom link text/i });
    fireEvent.click(customTextSwitch);

    // Now save button should be visible
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  test('should show save button for external links', () => {
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

    // Save button should be visible for external links
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });
});
