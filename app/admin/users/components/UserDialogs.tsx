import React from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import type { User } from '../types';

interface UserDialogsProps {
  loadingAction: string | null;
  deleteUserId: User | null;
  setDeleteUserId: (u: User | null) => void;
  resetUserId: User | null;
  setResetUserId: (u: User | null) => void;
  editUsernameUser: User | null;
  setEditUsernameUser: (u: User | null) => void;
  newUsername: string;
  setNewUsername: (s: string) => void;
  verifyUser: User | null;
  setVerifyUser: (u: User | null) => void;
  toggleAdminUser: User | null;
  setToggleAdminUser: (u: User | null) => void;
  onDelete: (uid: string) => void;
  onResetPassword: (user: User) => void;
  onSendEmailVerification: (user: User) => void;
  onUsernameSave: () => void;
  onToggleAdminStatus: (user: User) => void;
}

export function UserDialogs({
  loadingAction,
  deleteUserId,
  setDeleteUserId,
  resetUserId,
  setResetUserId,
  editUsernameUser,
  setEditUsernameUser,
  newUsername,
  setNewUsername,
  verifyUser,
  setVerifyUser,
  toggleAdminUser,
  setToggleAdminUser,
  onDelete,
  onResetPassword,
  onSendEmailVerification,
  onUsernameSave,
  onToggleAdminStatus,
}: UserDialogsProps) {
  return (
    <>
      <Dialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              This will permanently delete the user account{deleteUserId ? ` (${deleteUserId.email})` : ''}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteUserId(null)} disabled={loadingAction !== null}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteUserId && onDelete(deleteUserId.uid)}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'delete' ? <Icon name="Loader" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUserId} onOpenChange={(open) => !open && setResetUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Send a password reset email and generate a reset link for this user{resetUserId ? ` (${resetUserId.email})` : ''}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResetUserId(null)} disabled={loadingAction !== null}>
              Cancel
            </Button>
            <Button
              onClick={() => resetUserId && onResetPassword(resetUserId)}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'reset' ? <Icon name="Loader" /> : 'Send reset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUsernameUser} onOpenChange={(open) => !open && setEditUsernameUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change username</DialogTitle>
            <DialogDescription>
              Update the username for {editUsernameUser?.email}. Please confirm to avoid accidental changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="Enter new username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
            />
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setEditUsernameUser(null)}
              disabled={loadingAction !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={onUsernameSave}
              disabled={loadingAction !== null || newUsername.trim().length < 3}
            >
              {loadingAction === 'username' ? <Icon name="Loader" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!verifyUser} onOpenChange={(open) => !open && setVerifyUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send verification email</DialogTitle>
            <DialogDescription>
              Send a verification email to {verifyUser?.email}. The user must verify before payouts are allowed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setVerifyUser(null)}
              disabled={loadingAction !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={() => verifyUser && onSendEmailVerification(verifyUser)}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'verify' ? <Icon name="Loader" /> : 'Send verification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toggleAdminUser} onOpenChange={(open) => !open && setToggleAdminUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toggleAdminUser?.isAdmin ? 'Revoke admin access' : 'Grant admin access'}
            </DialogTitle>
            <DialogDescription>
              {toggleAdminUser?.isAdmin
                ? `Remove admin privileges from ${toggleAdminUser?.email}? They will lose access to the admin dashboard.`
                : `Grant admin access to ${toggleAdminUser?.email}? They will be able to access the admin dashboard and manage users.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setToggleAdminUser(null)}
              disabled={loadingAction !== null}
            >
              Cancel
            </Button>
            <Button
              variant={toggleAdminUser?.isAdmin ? 'destructive' : 'default'}
              onClick={() => toggleAdminUser && onToggleAdminStatus(toggleAdminUser)}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'admin' ? (
                <Icon name="Loader" className="mr-1" />
              ) : null}
              {toggleAdminUser?.isAdmin ? 'Revoke access' : 'Grant access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
