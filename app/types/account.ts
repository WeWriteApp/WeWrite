// Minimal session types for hybrid architecture
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
  emailVerified?: boolean; // Track email verification status
}

// Session error handling
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

// Session change events
export interface SessionChangeEvent {
  type: 'added' | 'removed' | 'updated' | 'activated' | 'deactivated';
  session: UserAccount;
  previousSession?: UserAccount;
}

// SessionBag state and actions
export interface MultiAuthState {
  sessions: UserAccount[];
  isLoading: boolean;
  error: string | null;
}

export interface MultiAuthActions {
  addSession: (session: Omit<UserAccount, 'sessionId' | 'createdAt' | 'lastActiveAt' | 'isActive'>) => Promise<UserAccount>;
  removeSession: (sessionId: string) => Promise<void>;
  updateSession: (sessionId: string, updates: Partial<UserAccount>) => Promise<void>;
  clearAllSessions: () => Promise<void>;
  getSession: (sessionId: string) => UserAccount | null;
  getAllSessions: () => UserAccount[];
  getSessionByUid: (uid: string) => UserAccount | null;
  refreshSession: (sessionId: string) => Promise<UserAccount>;
  cleanupExpiredSessions: () => Promise<void>;
}

// CurrentSession state and actions
export interface CurrentAccountState {
  currentAccount: UserAccount | null;
  session: UserAccount | null; // Alias for backward compatibility
  isAuthenticated: boolean; // Computed from currentAccount and email verification
  isEmailVerified: boolean; // Computed from currentAccount email verification status
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;
}

export interface CurrentAccountActions {
  switchAccount: (sessionId: string) => Promise<void>;
  switchAccountByUid: (uid: string) => Promise<void>;
  signOutCurrent: () => Promise<void>;
  refreshActiveAccount: () => Promise<void>;
  updateActiveAccount: (updates: Partial<UserAccount>) => Promise<void>;
  markAsHydrated: () => void;
}

// Combined interfaces
export interface MultiAuthContextValue extends MultiAuthState, MultiAuthActions {}
export interface CurrentAccountContextValue extends CurrentAccountState, CurrentAccountActions {}