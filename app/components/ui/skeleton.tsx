import { cn } from "../../lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/20",
        className
      )}
      {...props}
    />
  );
}

function ShimmerEffect({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/20 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-muted/40 before:to-transparent",
        className
      )}
      {...props}
    />
  );
}

/**
 * Username skeleton specifically for user badges
 */
function UsernameSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      className={cn("inline-block w-20 h-4 rounded", className)}
    />
  );
}

/**
 * Notification item skeleton for loading states
 */
function NotificationSkeleton() {
  return (
    <div className="wewrite-card rounded-xl border-theme-strong shadow-sm p-4">
      <div className="flex items-start gap-3">
        {/* Avatar skeleton */}
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />

        <div className="flex-1 min-w-0">
          {/* Username skeleton */}
          <div className="flex items-center mb-2">
            <Skeleton className="w-24 h-4 rounded" />
          </div>

          {/* Content skeleton */}
          <div className="space-y-2">
            <Skeleton className="w-full h-4 rounded" />
            <Skeleton className="w-3/4 h-4 rounded" />
          </div>

          {/* Timestamp skeleton */}
          <div className="mt-3">
            <Skeleton className="w-16 h-3 rounded" />
          </div>
        </div>

        {/* Action button skeleton */}
        <Skeleton className="w-6 h-6 rounded" />
      </div>
    </div>
  );
}

/**
 * Multiple notification skeletons for initial loading
 */
function NotificationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <NotificationSkeleton key={i} />
      ))}
    </div>
  );
}

export { Skeleton, ShimmerEffect, UsernameSkeleton, NotificationSkeleton, NotificationListSkeleton };