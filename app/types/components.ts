/**
 * Component prop types for WeWrite application
 */

import { ReactNode, MouseEvent, KeyboardEvent, ChangeEvent } from 'react';
import {
  User,
  Page,
  Group,
  EditorContent,
  ViewMode,
  LineMode,
  LinkData,
  EditorRef,
  Activity,
  Notification,
  SearchResult
} from './database';

// Re-export types that are used by components
export type { LinkData, EditorRef } from './database';

// Base component props
export interface BaseProps {
  className?: string;
  children?: ReactNode;
}

// TextView component props
export interface TextViewProps extends BaseProps {
  content: EditorContent | string;
  isSearch?: boolean;
  viewMode?: ViewMode;
  onRenderComplete?: () => void;
  setIsEditing?: (editing: boolean, position?: { x: number; y: number; clientX: number; clientY: number } | null) => void;
  showDiff?: boolean;
  canEdit?: boolean;
  onActiveLine?: (lineIndex: number) => void;
  showLineNumbers?: boolean;
  isEditing?: boolean;
}

// Editor component props
export interface EditorProps extends BaseProps {
  initialContent?: EditorContent;
  onChange?: (content: EditorContent) => void;
  placeholder?: string;
  contentType?: 'wiki' | 'about' | 'bio';
  onKeyDown?: (event: KeyboardEvent) => void;
  ref?: React.RefObject<EditorRef>;
  onEmptyLinesChange?: (count: number) => void;
}

// PageEditor component props
export interface PageEditorProps extends BaseProps {
  title: string;
  setTitle: (title: string) => void;
  initialContent: EditorContent;
  onContentChange: (content: EditorContent) => void;
  location?: string;
  setLocation?: (location: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  isSaving: boolean;
  error?: string | null;
  isNewPage: boolean;
  clickPosition?: { x: number; y: number } | null;
  page?: Page;
}

// PageView component props
export interface PageViewProps extends BaseProps {
  params: Promise<{ id: string }> | { id: string };
  initialEditMode?: boolean;
  showVersion?: boolean;
  versionId?: string;
  showDiff?: boolean;
  compareVersionId?: string;
}

// UserBioTab component props
export interface UserBioTabProps extends BaseProps {
  profile: User;
}

// GroupAboutTab component props
export interface GroupAboutTabProps extends BaseProps {
  group: Group;
  canEdit: boolean;
}

// Activity component props
export interface ActivityProps extends BaseProps {
  activities: Activity[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

// Search component props
export interface SearchProps extends BaseProps {
  query?: string;
  onQueryChange?: (query: string) => void;
  results?: SearchResult[];
  loading?: boolean;
  onSearch?: (query: string) => void;
  placeholder?: string;
}

// Notification component props
export interface NotificationProps extends BaseProps {
  notifications: Notification[];
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
}

// Button component props
export interface ButtonProps extends BaseProps {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
}

// Input component props
export interface InputProps extends BaseProps {
  type?: 'text' | 'email' | 'password' | 'url' | 'search';
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
}

// Modal component props
export interface ModalProps extends BaseProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Dropdown component props
export interface DropdownProps extends BaseProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
}

// Tab component props
export interface TabsProps extends BaseProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export interface TabProps extends BaseProps {
  value: string;
  disabled?: boolean;
}

// Card component props
export interface CardProps extends BaseProps {
  title?: string;
  description?: string;
  footer?: ReactNode;
  hover?: boolean;
}

// Loading component props
export interface LoadingProps extends BaseProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

// Error component props
export interface ErrorProps extends BaseProps {
  error: Error | string;
  onRetry?: () => void;
  showDetails?: boolean;
}

// Pagination component props
export interface PaginationProps extends BaseProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showFirstLast?: boolean;
  showPrevNext?: boolean;
}

// Toast component props
export interface ToastProps extends BaseProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
  duration?: number;
  onClose?: () => void;
}

// Context types
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export interface ThemeContextType {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
}

export interface LineSettingsContextType {
  lineMode: LineMode;
  setLineMode: (mode: LineMode) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

// Hook return types
export interface UsePageReturn {
  page: Page | null;
  loading: boolean;
  error: string | null;
  updatePage: (updates: Partial<Page>) => Promise<void>;
  deletePage: () => Promise<void>;
}

export interface UsePagesReturn {
  pages: Page[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface UseSearchReturn {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
  clearResults: () => void;
}