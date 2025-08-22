import React from 'react';
import { cn } from '../../utils/cn';
import { ErrorDisplay } from './error-display';
import UnifiedLoader from './unified-loader';

export interface AsyncCardProps {
  loading?: boolean;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
  loadingText?: string;
  showErrorBoundary?: boolean;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
  isEmpty?: boolean;
}

/**
 * Reusable card component that handles async states (loading, error, empty)
 * Consolidates the common pattern of showing loading/error states in cards
 * 
 * @example
 * ```typescript
 * const { data, loading, error } = useAsyncState<User[]>();
 * 
 * return (
 *   <AsyncCard 
 *     loading={loading} 
 *     error={error}
 *     isEmpty={data?.length === 0}
 *     emptyState={<div>No users found</div>}
 *   >
 *     {data?.map(user => <UserCard key={user.id} user={user} />)}
 *   </AsyncCard>
 * );
 * ```
 */
export function AsyncCard({
  loading = false,
  error = null,
  children,
  className,
  loadingText = 'Loading...',
  showErrorBoundary = true,
  onRetry,
  emptyState,
  isEmpty = false
}: AsyncCardProps) {
  return (
    <div className={cn('wewrite-card', className)}>
      {loading && (
        <div className="flex items-center justify-center p-8">
          <UnifiedLoader text={loadingText} />
        </div>
      )}
      
      {error && showErrorBoundary && (
        <div className="p-4">
          <ErrorDisplay 
            error={error} 
            onRetry={onRetry}
            className="border-0 bg-transparent p-0"
          />
        </div>
      )}
      
      {!loading && !error && isEmpty && emptyState && (
        <div className="p-8 text-center text-muted-foreground">
          {emptyState}
        </div>
      )}
      
      {!loading && !error && !isEmpty && children}
    </div>
  );
}

/**
 * Simplified version for basic loading/content scenarios
 */
export function SimpleAsyncCard({
  loading,
  children,
  className,
  loadingText = 'Loading...'
}: {
  loading: boolean;
  children: React.ReactNode;
  className?: string;
  loadingText?: string;
}) {
  return (
    <AsyncCard
      loading={loading}
      className={className}
      loadingText={loadingText}
      showErrorBoundary={false}
    >
      {children}
    </AsyncCard>
  );
}

/**
 * Card specifically for list/grid content with empty states
 */
export function ListAsyncCard<T>({
  data,
  loading,
  error,
  children,
  className,
  emptyMessage = 'No items found',
  onRetry
}: {
  data: T[] | null;
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
  className?: string;
  emptyMessage?: string;
  onRetry?: () => void;
}) {
  return (
    <AsyncCard
      loading={loading}
      error={error}
      className={className}
      isEmpty={data?.length === 0}
      emptyState={<div>{emptyMessage}</div>}
      onRetry={onRetry}
    >
      {children}
    </AsyncCard>
  );
}

/**
 * Card for form content with submission states
 */
export function FormAsyncCard({
  submitting,
  submitError,
  children,
  className,
  onRetry
}: {
  submitting: boolean;
  submitError: string | null;
  children: React.ReactNode;
  className?: string;
  onRetry?: () => void;
}) {
  return (
    <AsyncCard
      loading={submitting}
      error={submitError}
      className={className}
      loadingText="Saving..."
      onRetry={onRetry}
    >
      {children}
    </AsyncCard>
  );
}
