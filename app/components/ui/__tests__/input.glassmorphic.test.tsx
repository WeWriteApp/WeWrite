/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Input } from '../input';
import { Textarea } from '../textarea';

describe('Glassmorphic Input Styling', () => {
  test('Input component should have wewrite-input class', () => {
    render(<Input data-testid="test-input" placeholder="Test input" />);
    
    const input = screen.getByTestId('test-input');
    expect(input).toHaveClass('wewrite-input');
  });

  test('Textarea component should have wewrite-input class', () => {
    render(<Textarea data-testid="test-textarea" placeholder="Test textarea" />);
    
    const textarea = screen.getByTestId('test-textarea');
    expect(textarea).toHaveClass('wewrite-input');
  });

  test('Input should maintain additional classes', () => {
    render(
      <Input 
        data-testid="test-input" 
        className="custom-class another-class" 
        placeholder="Test input" 
      />
    );
    
    const input = screen.getByTestId('test-input');
    expect(input).toHaveClass('wewrite-input');
    expect(input).toHaveClass('custom-class');
    expect(input).toHaveClass('another-class');
  });

  test('Textarea should maintain additional classes', () => {
    render(
      <Textarea 
        data-testid="test-textarea" 
        className="custom-class another-class" 
        placeholder="Test textarea" 
      />
    );
    
    const textarea = screen.getByTestId('test-textarea');
    expect(textarea).toHaveClass('wewrite-input');
    expect(textarea).toHaveClass('custom-class');
    expect(textarea).toHaveClass('another-class');
  });

  test('Input should have proper utility classes', () => {
    render(<Input data-testid="test-input" />);
    
    const input = screen.getByTestId('test-input');
    expect(input).toHaveClass('flex');
    expect(input).toHaveClass('h-10');
    expect(input).toHaveClass('w-full');
    expect(input).toHaveClass('text-sm');
  });

  test('Textarea should have proper utility classes', () => {
    render(<Textarea data-testid="test-textarea" />);
    
    const textarea = screen.getByTestId('test-textarea');
    expect(textarea).toHaveClass('flex');
    expect(textarea).toHaveClass('min-h-[80px]');
    expect(textarea).toHaveClass('w-full');
    expect(textarea).toHaveClass('text-sm');
    expect(textarea).toHaveClass('resize-vertical');
  });

  test('Input should accept all standard input props', () => {
    render(
      <Input 
        data-testid="test-input"
        type="email"
        value="test@example.com"
        onChange={() => {}}
        disabled
        required
        placeholder="Enter email"
      />
    );
    
    const input = screen.getByTestId('test-input');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('value', 'test@example.com');
    expect(input).toBeDisabled();
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('placeholder', 'Enter email');
  });

  test('Textarea should accept all standard textarea props', () => {
    render(
      <Textarea
        data-testid="test-textarea"
        value="Test content"
        onChange={() => {}}
        disabled
        required
        placeholder="Enter text"
        rows={5}
      />
    );

    const textarea = screen.getByTestId('test-textarea');
    expect(textarea).toHaveValue('Test content'); // Use toHaveValue for textarea content
    expect(textarea).toBeDisabled();
    expect(textarea).toBeRequired();
    expect(textarea).toHaveAttribute('placeholder', 'Enter text');
    expect(textarea).toHaveAttribute('rows', '5');
  });
});
