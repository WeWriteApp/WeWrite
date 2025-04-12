import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";

interface Payout {
  id: string;
  pageId: string;
  amount: number;
  platformFee: number;
  totalAmount: number;
  pledgeCount: number;
  status: string;
  payoutDate: string;
  createdAt: string;
}

interface PayoutHistoryTableProps {
  payouts: Payout[];
}

const PayoutHistoryTable: React.FC<PayoutHistoryTableProps> = ({ payouts }) => {
  // Sort payouts by date (newest first)
  const sortedPayouts = [...payouts].sort((a, b) => {
    return new Date(b.payoutDate || b.createdAt).getTime() -
           new Date(a.payoutDate || a.createdAt).getTime();
  });

  if (sortedPayouts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No payout history available yet.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Payouts are processed at the end of each month.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead className="hidden md:table-cell">Platform Fee</TableHead>
            <TableHead className="hidden md:table-cell">Donors</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPayouts.map((payout) => (
            <TableRow key={payout.id}>
              <TableCell>
                {formatDate(payout.payoutDate || payout.createdAt)}
              </TableCell>
              <TableCell className="font-medium">
                ${payout.amount.toFixed(2)}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                ${payout.platformFee.toFixed(2)}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {payout.pledgeCount}
              </TableCell>
              <TableCell>
                <StatusBadge status={payout.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

// Helper function to format date
const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';

  switch (status.toLowerCase()) {
    case 'completed':
      variant = 'default';
      break;
    case 'pending':
      variant = 'secondary';
      break;
    case 'failed':
      variant = 'destructive';
      break;
    default:
      variant = 'outline';
  }

  return (
    <Badge variant={variant}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

export default PayoutHistoryTable;
