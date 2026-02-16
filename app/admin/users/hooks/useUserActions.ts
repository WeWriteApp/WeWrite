import { useState } from 'react';
import { adminFetch } from '../../../utils/adminFetch';
import type { User } from '../types';

export function useUserActions(
  setUsers: React.Dispatch<React.SetStateAction<User[]>>,
  refreshUserNotifications: (uid: string) => Promise<void>,
) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error" | "warning"; message: string; details?: string } | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<User | null>(null);
  const [resetUserId, setResetUserId] = useState<User | null>(null);
  const [editUsernameUser, setEditUsernameUser] = useState<User | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [verifyUser, setVerifyUser] = useState<User | null>(null);
  const [toggleAdminUser, setToggleAdminUser] = useState<User | null>(null);

  const handleDelete = async (uid: string) => {
    setStatus(null);
    setLoadingAction('delete');
    try {
      const res = await adminFetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Delete failed');

      setUsers((prev) => prev.filter((u) => u.uid !== uid));

      if (data.manualActionRequired) {
        setStatus({
          type: 'warning',
          message: `${data.message}. Firebase Auth user must be deleted manually.`,
          details: `Go to Firebase Console → Authentication → Users and delete the user with email: ${data.email || 'unknown'}`
        });
        if (data.manualActionRequired.url) {
          window.open(data.manualActionRequired.url, '_blank');
        }
      } else if (data.warnings && data.warnings.length > 0) {
        setStatus({
          type: 'warning',
          message: data.message,
          details: data.warnings.join('. ')
        });
      } else {
        setStatus({ type: 'success', message: data.message || 'User deleted' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Delete failed' });
    } finally {
      setLoadingAction(null);
      setDeleteUserId(null);
    }
  };

  const handleResetPassword = async (user: User) => {
    setStatus(null);
    setLoadingAction('reset');
    try {
      const res = await adminFetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Reset failed');
      const msg = data.message || 'Reset link generated';
      setStatus({ type: 'success', message: `${msg} ${data.resetLink ? '(link copied to response)' : ''}` });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Reset failed' });
    } finally {
      setLoadingAction(null);
      setResetUserId(null);
    }
  };

  const handleSendEmailVerification = async (user: User) => {
    setStatus(null);
    setLoadingAction('verify');
    try {
      const res = await adminFetch('/api/email/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          userId: user.uid,
          username: user.username,
          idToken: 'admin-bypass'
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to send verification');
      setStatus({ type: 'success', message: 'Verification email sent via Resend' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to send verification' });
    } finally {
      setLoadingAction(null);
      setVerifyUser(null);
    }
  };

  const handleUsernameSave = async () => {
    if (!editUsernameUser) return;
    setStatus(null);
    setLoadingAction('username');
    try {
      const res = await adminFetch('/api/admin/users/update-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: editUsernameUser.uid, username: newUsername.trim() })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Username update failed');

      setUsers((prev) =>
        prev.map((u) =>
          u.uid === editUsernameUser.uid ? { ...u, username: data.username } : u
        )
      );
      setStatus({ type: 'success', message: 'Username updated' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Username update failed' });
    } finally {
      setLoadingAction(null);
      setEditUsernameUser(null);
      setNewUsername('');
    }
  };

  const handleSendPayoutReminder = async (user: User) => {
    setStatus(null);
    setLoadingAction("notify");
    try {
      const res = await adminFetch("/api/admin/users/send-payout-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          amountUsd: user.financial?.availableEarningsUsd
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to send reminder");
      setStatus({ type: "success", message: data.message || "Reminder sent" });
      await refreshUserNotifications(user.uid);
    } catch (err: any) {
      setStatus({ type: "error", message: err.message || "Failed to send reminder" });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleToggleAdminStatus = async (user: User) => {
    setStatus(null);
    setLoadingAction('admin');
    const newAdminStatus = !user.isAdmin;
    try {
      const res = await adminFetch('/api/admin/users/admin-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, isAdmin: newAdminStatus })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to update admin status');

      setUsers((prev) =>
        prev.map((u) =>
          u.uid === user.uid ? { ...u, isAdmin: newAdminStatus } : u
        )
      );
      setStatus({
        type: 'success',
        message: `Admin access ${newAdminStatus ? 'granted to' : 'revoked from'} ${user.email}`
      });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to update admin status' });
    } finally {
      setLoadingAction(null);
      setToggleAdminUser(null);
    }
  };

  return {
    loadingAction,
    status,
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
    handleDelete,
    handleResetPassword,
    handleSendEmailVerification,
    handleUsernameSave,
    handleSendPayoutReminder,
    handleToggleAdminStatus,
  };
}
