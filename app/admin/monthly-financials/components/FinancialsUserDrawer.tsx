import React from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  SideDrawer,
  SideDrawerContent,
  SideDrawerHeader,
  SideDrawerBody,
  SideDrawerFooter,
  SideDrawerTitle,
  SideDrawerDescription,
} from '../../../components/ui/side-drawer';

interface FinancialsUserDrawerProps {
  selectedUserEmail: string | null;
  selectedUserData: any;
  loadingUserData: boolean;
  onClose: () => void;
}

export function FinancialsUserDrawer({ selectedUserEmail, selectedUserData, loadingUserData, onClose }: FinancialsUserDrawerProps) {
  const router = useRouter();

  return (
    <SideDrawer open={!!selectedUserEmail} onOpenChange={(open) => !open && onClose()}>
      <SideDrawerContent side="right" size="xl">
        <SideDrawerHeader>
          <SideDrawerTitle>User Details</SideDrawerTitle>
          <SideDrawerDescription>
            {selectedUserEmail}
          </SideDrawerDescription>
        </SideDrawerHeader>
        <SideDrawerBody>
          {loadingUserData ? (
            <div className="flex items-center justify-center py-12">
              <Icon name="Loader" className="text-muted-foreground" />
            </div>
          ) : selectedUserData ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 grid-cols-2">
                <div>
                  <div className="text-muted-foreground">Email</div>
                  <div className="font-medium break-all">{selectedUserData.email}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Username</div>
                  <div className="font-medium">{selectedUserData.username || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Admin</div>
                  {selectedUserData.isAdmin ? (
                    <Badge variant="success-secondary">Admin</Badge>
                  ) : (
                    <Badge variant="outline-static">Not admin</Badge>
                  )}
                </div>
                <div>
                  <div className="text-muted-foreground">Email verified</div>
                  {selectedUserData.emailVerified ? (
                    <Badge variant="success-secondary">Verified</Badge>
                  ) : (
                    <Badge variant="destructive-secondary">Unverified</Badge>
                  )}
                </div>
                <div>
                  <div className="text-muted-foreground">Created</div>
                  <div className="font-medium">
                    {selectedUserData.createdAt
                      ? new Date(selectedUserData.createdAt?._seconds ? selectedUserData.createdAt._seconds * 1000 : selectedUserData.createdAt).toLocaleString()
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Last login</div>
                  <div className="font-medium">
                    {selectedUserData.lastLogin
                      ? new Date(selectedUserData.lastLogin?._seconds ? selectedUserData.lastLogin._seconds * 1000 : selectedUserData.lastLogin).toLocaleString()
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total pages</div>
                  <div className="font-medium">{selectedUserData.totalPages ?? '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Stripe account</div>
                  <div className="font-medium break-all text-xs">{selectedUserData.stripeConnectedAccountId || '—'}</div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="CreditCard" size={16} className="text-blue-400" />
                  <span className="font-medium">Subscription</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {selectedUserData.financial?.hasSubscription ? (
                    <Badge variant="success-secondary">
                      Active &bull; ${(selectedUserData.financial.subscriptionAmount ?? 0).toFixed(2)}
                    </Badge>
                  ) : (
                    <Badge variant="outline-static">None</Badge>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="Banknote" size={16} className="text-emerald-400" />
                  <span className="font-medium">Payouts</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {selectedUserData.financial?.payoutsSetup || selectedUserData.stripeConnectedAccountId ? (
                    <Badge variant="success-secondary">Connected</Badge>
                  ) : (
                    <Badge variant="outline-static">Not set up</Badge>
                  )}
                  <span className="text-muted-foreground text-xs">
                    Available: {selectedUserData.financial?.availableEarningsUsd !== undefined
                      ? `$${selectedUserData.financial.availableEarningsUsd.toFixed(2)}`
                      : '—'}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Total: {selectedUserData.financial?.earningsTotalUsd !== undefined
                      ? `$${selectedUserData.financial.earningsTotalUsd.toFixed(2)}`
                      : '—'}
                  </span>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/admin/users?search=${encodeURIComponent(selectedUserData.email)}`)}
                >
                  View in Users Admin
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              User not found in system
            </div>
          )}
        </SideDrawerBody>
        <SideDrawerFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </SideDrawerFooter>
      </SideDrawerContent>
    </SideDrawer>
  );
}
