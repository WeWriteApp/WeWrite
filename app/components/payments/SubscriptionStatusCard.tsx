import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SubscriptionStatusCardProps {
  isActive: boolean;
  nextPaymentDate: string;
  amount: number;
  onCancel: () => void;
}

const SubscriptionStatusCard: React.FC<SubscriptionStatusCardProps> = ({
  isActive,
  nextPaymentDate,
  amount,
  onCancel
}) => {
  const router = useRouter();

  // Format the date from ISO string
  const formattedDate = nextPaymentDate ?
    new Date(nextPaymentDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) :
    'Unknown';

  return (
    <div className="bg-background rounded-lg border-theme-medium p-4">
      {isActive ? (
        <>
          <div className="flex items-center mb-3">
            <CheckCircle className="text-success mr-2 h-5 w-5" />
            <h3 className="text-base font-medium">Your subscription is active</h3>
          </div>
          <div className="border-t-only border-b-only py-3 mb-3">
            <p className="text-sm text-muted-foreground mb-1">
              Next payment: <span className="text-foreground font-medium">{formattedDate}</span>
            </p>
            <p className="text-foreground font-semibold">${amount.toFixed(2)}/month</p>
          </div>
          <button
            className="flex items-center text-red-500 hover:text-red-600 transition-colors text-sm"
            onClick={onCancel}
          >
            <XCircle className="mr-1 h-4 w-4" />
            <span>Cancel subscription</span>
          </button>
        </>
      ) : (
        <div className="text-center py-2">
          <h3 className="text-base font-medium mb-1">No active subscription</h3>
          <p className="text-sm text-muted-foreground mb-4">Start one to begin supporting creators.</p>

          <button
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
            onClick={() => router.push('/settings/subscription')}
          >
            Set up subscription
          </button>
        </div>
      )}
    </div>
  );
};

export default SubscriptionStatusCard;