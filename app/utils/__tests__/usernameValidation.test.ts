/**
 * Tests for username validation utilities
 */

import { validateLoginInput, validateUsernameFormat, isValidEmail } from '../usernameValidation';

describe('validateLoginInput', () => {
  test('should accept valid email addresses', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.co.uk',
      'user+tag@example.org',
      'user123@test-domain.com'
    ];

    validEmails.forEach(email => {
      const result = validateLoginInput(email);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.message).toBeNull();
    });
  });

  test('should reject invalid email addresses', () => {
    const invalidEmails = [
      'invalid@',
      '@domain.com',
      'user@',
      'user@domain',
      'user @domain.com',
      'user@domain .com'
    ];

    invalidEmails.forEach(email => {
      const result = validateLoginInput(email);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('INVALID_EMAIL');
      expect(result.message).toBe('Please enter a valid email address');
    });
  });

  test('should accept valid usernames', () => {
    const validUsernames = [
      'user123',
      'test_user',
      'username',
      'user_name_123',
      'abc'
    ];

    validUsernames.forEach(username => {
      const result = validateLoginInput(username);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.message).toBeNull();
    });
  });

  test('should reject usernames that are too short', () => {
    const shortUsernames = ['a', 'ab'];

    shortUsernames.forEach(username => {
      const result = validateLoginInput(username);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('TOO_SHORT');
      expect(result.message).toBe('Username must be at least 3 characters');
    });
  });

  test('should reject usernames with whitespace', () => {
    const usernamesWithWhitespace = [
      'user name',
      'user\tname',
      'user\nname'
    ];

    usernamesWithWhitespace.forEach(username => {
      const result = validateLoginInput(username);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('CONTAINS_WHITESPACE');
      expect(result.message).toBe('Usernames cannot contain spaces or whitespace characters. Try using underscores (_) instead.');
    });
  });

  test('should reject usernames with invalid characters', () => {
    const invalidUsernames = [
      'user-name',
      'user.name',
      'user#name',
      'user!name'
    ];

    invalidUsernames.forEach(username => {
      const result = validateLoginInput(username);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('INVALID_CHARACTERS');
      expect(result.message).toBe('Username can only contain letters, numbers, and underscores');
    });
  });

  test('should treat inputs with @ as emails and validate accordingly', () => {
    // These contain @ so they're treated as emails, not usernames
    const invalidEmailsWithAt = [
      'user@name',
      'user@',
      '@user'
    ];

    invalidEmailsWithAt.forEach(input => {
      const result = validateLoginInput(input);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('INVALID_EMAIL');
      expect(result.message).toBe('Please enter a valid email address');
    });
  });

  test('should handle edge case of username-like strings without @', () => {
    // This doesn't contain @ so it's treated as a username
    const result = validateLoginInput('user.domain.com');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('INVALID_CHARACTERS');
    expect(result.message).toBe('Username can only contain letters, numbers, and underscores');
  });

  test('should reject empty input', () => {
    const emptyInputs = ['', '   ', '\t', '\n'];

    emptyInputs.forEach(input => {
      const result = validateLoginInput(input);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('EMPTY_INPUT');
      expect(result.message).toBe('Please enter your email or username');
    });
  });
});

describe('isValidEmail', () => {
  test('should correctly identify valid emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
  });

  test('should correctly identify invalid emails', () => {
    expect(isValidEmail('invalid@')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('username')).toBe(false);
  });
});

describe('validateUsernameFormat', () => {
  test('should accept valid usernames', () => {
    const result = validateUsernameFormat('valid_username123');
    expect(result.isValid).toBe(true);
  });

  test('should reject invalid usernames', () => {
    const result = validateUsernameFormat('ab');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('TOO_SHORT');
  });
});
