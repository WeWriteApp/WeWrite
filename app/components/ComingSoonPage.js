"use client";
import DashboardLayout from "../DashboardLayout";
import EmptyState from "./EmptyState";

const ComingSoonPage = ({ 
  title,
  description = "This feature is coming soon. Check back later!",
  icon,
  actionLabel = "Back to home",
  actionHref = "/"
}) => {
  return (
    <DashboardLayout>
      <div className="h-[80vh] flex items-center justify-center">
        <EmptyState
          title={title}
          description={description}
          icon={icon}
          actionLabel={actionLabel}
          actionHref={actionHref}
        />
      </div>
    </DashboardLayout>
  );
};

export default ComingSoonPage; 