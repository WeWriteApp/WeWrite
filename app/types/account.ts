// Legacy types - kept for backward compatibility during migration
// These will be removed once all references are updated to use auth types

export interface UserAccount {
  uid: string;
  email: string;
  username: string;
  displayName?: string;
  sessionId: string;
  createdAt: string;
  lastActiveAt: string;
  isActive: boolean;
  isPersistent?: boolean;
  fromAccountSwitch?: boolean;
  emailVerified?: boolean;
}

// Session error handling - legacy
export const SESSION_ERROR_CODES = {
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  STORAGE_ERROR: 'STORAGE_ERROR',
  INVALID_SESSION: 'INVALID_SESSION'} as const;

export class SessionError extends Error {
  constructor(
    message: string,
    public code: keyof typeof SESSION_ERROR_CODES,
    public sessionId?: string
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

// Legacy multi-auth types removed - use auth types from auth.ts instead