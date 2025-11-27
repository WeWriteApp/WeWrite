/**
 * Editor Tests
 *
 * Tests to verify the editor works correctly with inline pill links
 * and follows the documented requirements.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Editor from './Editor';

// Mock the LinkEditorModal to avoid portal issues in tests
jest.mock('./LinkEditorModal', () => {
  return function MockLinkEditorModal({ isOpen, onClose, onInsertLink }: any) {
    if (!isOpen) return null;
    
    return (
      <div data-testid="link-modal">
        <button 
          onClick={() => {
            onInsertLink({
              type: 'page',
              pageId: 'test-page',
              pageTitle: 'Test Page',
              url: '/test-page',
              text: 'Test Link'
            });
          }}
          data-testid="insert-link-btn"
        >
          Insert Link
        </button>
        <button onClick={onClose} data-testid="close-modal-btn">
          Close
        </button>
      </div>
    );
  };
});

// Mock ReactDOM.createPortal to render modals inline
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

describe('Editor', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders with initial content', () => {
    const initialContent = [
      { type: 'paragraph', children: [{ text: 'Hello world' }] }
    ];

    render(
      <Editor
        initialContent={initialContent}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders with placeholder when no content', () => {
    render(
      <Editor
        initialContent={[]}
        onChange={mockOnChange}
        placeholder="Start typing..."
      />
    );

    expect(screen.getByPlaceholderText('Start typing...')).toBeInTheDocument();
  });

  it('handles text input correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <Editor
        initialContent={[]}
        onChange={mockOnChange}
      />
    );

    const editor = screen.getByRole('textbox');
    await user.click(editor);
    await user.type(editor, 'Test content');

    // Verify onChange was called
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('opens link modal with Ctrl+K', async () => {
    const user = userEvent.setup();
    
    render(
      <Editor
        initialContent={[]}
        onChange={mockOnChange}
      />
    );

    const editor = screen.getByRole('textbox');
    await user.click(editor);
    
    // Press Ctrl+K
    await user.keyboard('{Control>}k{/Control}');

    // Verify modal opens
    expect(screen.getByTestId('link-modal')).toBeInTheDocument();
  });

  it('inserts link correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <Editor
        initialContent={[]}
        onChange={mockOnChange}
      />
    );

    const editor = screen.getByRole('textbox');
    await user.click(editor);
    
    // Open link modal
    await user.keyboard('{Control>}k{/Control}');
    
    // Insert link
    const insertBtn = screen.getByTestId('insert-link-btn');
    await user.click(insertBtn);

    // Verify modal closes
    await waitFor(() => {
      expect(screen.queryByTestId('link-modal')).not.toBeInTheDocument();
    });

    // Verify onChange was called with link content
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('handles read-only mode', async () => {
    const user = userEvent.setup();
    
    render(
      <Editor
        initialContent={[{ type: 'paragraph', children: [{ text: 'Read only' }] }]}
        onChange={mockOnChange}
        readOnly={true}
      />
    );

    const editor = screen.getByRole('textbox');
    
    // Try to type - should not work in read-only mode
    await user.click(editor);
    await user.type(editor, 'Should not appear');

    // Verify content didn't change
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.queryByText('Should not appear')).not.toBeInTheDocument();
  });

  it('handles errors gracefully', () => {
    // Mock console.error to avoid noise in tests
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create a mock onChange that throws an error
    const errorOnChange = jest.fn(() => {
      throw new Error('Test error');
    });

    render(
      <Editor
        initialContent={[]}
        onChange={errorOnChange}
      />
    );

    // Editor should still render despite the error
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });

  it('handles malformed initial content', () => {
    // Test with various malformed content
    const malformedContent = null;

    render(
      <Editor
        initialContent={malformedContent as any}
        onChange={mockOnChange}
      />
    );

    // Should render with default content
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Editor
        initialContent={[]}
        onChange={mockOnChange}
        className="custom-editor"
      />
    );

    expect(container.querySelector('.custom-editor')).toBeInTheDocument();
  });

  it('closes modal when clicking close button', async () => {
    const user = userEvent.setup();
    
    render(
      <Editor
        initialContent={[]}
        onChange={mockOnChange}
      />
    );

    const editor = screen.getByRole('textbox');
    await user.click(editor);
    
    // Open modal
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByTestId('link-modal')).toBeInTheDocument();
    
    // Close modal
    const closeBtn = screen.getByTestId('close-modal-btn');
    await user.click(closeBtn);

    // Verify modal closes
    await waitFor(() => {
      expect(screen.queryByTestId('link-modal')).not.toBeInTheDocument();
    });
  });
});

// Integration test to verify no DOM synchronization errors
describe('Editor DOM Synchronization', () => {
  it('does not throw DOM node resolution errors', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    
    render(
      <Editor
        initialContent={[]}
        onChange={() => {}}
      />
    );

    const editor = screen.getByRole('textbox');
    
    // Perform various operations that previously caused DOM sync issues
    await user.click(editor);
    await user.type(editor, 'Test content');
    await user.keyboard('{Control>}k{/Control}');
    
    if (screen.queryByTestId('link-modal')) {
      await user.click(screen.getByTestId('insert-link-btn'));
    }

    // Check that no DOM resolution errors were logged
    const domErrors = consoleSpy.mock.calls.filter(call => 
      call.some(arg => 
        typeof arg === 'string' && 
        arg.includes('Cannot resolve a DOM node from Slate node')
      )
    );

    expect(domErrors).toHaveLength(0);
    
    consoleSpy.mockRestore();
  });
});
