"use client";

import React, { useMemo } from "react";
import { Icon } from '@/components/ui/Icon';
import { AdminSubpageHeader } from "../../components/admin/AdminSubpageHeader";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { UserDetailsDrawer } from "../../components/admin/UserDetailsDrawer";
import { useUsersData, useColumns, useUserActions, useUserDetails } from './hooks';
import {
  ColumnSelector,
  MobileUserDetails,
  UsersTable,
  UsersMobileList,
  UserDialogs,
} from './components';
import type { AdminUsersPageProps } from './types';

export default function AdminUsersPage({ drawerSubPath }: AdminUsersPageProps = {}) {
  const {
    users,
    setUsers,
    loading,
    error,
    errorDetails,
    copiedError,
    setCopiedError,
    search,
    setSearch,
    filtered,
    maxEarningsMonth,
    maxEarningsTotal,
    maxAllocatedCents,
    maxUnallocatedCents,
    getSorted,
  } = useUsersData();

  const {
    selectedUser,
    setSelectedUser,
    activityFilter,
    setActivityFilter,
    loadingActivities,
    isDesktop,
    filteredActivities,
    isViewingUserDetails,
    handleUserSelect,
    refreshUserNotifications,
  } = useUserDetails(users, drawerSubPath);

  const actions = useUserActions(setUsers, async (uid) => {
    await refreshUserNotifications(uid, activityFilter);
  });

  const {
    columns,
    visibleColumns,
    sortBy,
    draggedColumnId,
    setDraggedColumnId,
    dragOverColumnId,
    setDragOverColumnId,
    activeColumns,
    toggleColumn,
    reorderColumn,
    moveColumn,
    handleSort,
  } = useColumns({
    maxEarningsMonth,
    maxEarningsTotal,
    maxAllocatedCents,
    maxUnallocatedCents,
    setVerifyUser: actions.setVerifyUser,
  });

  const sorted = useMemo(
    () => getSorted(filtered, sortBy, columns),
    [filtered, sortBy, columns, getSorted]
  );

  // Mobile user detail view
  if (isViewingUserDetails && selectedUser) {
    return (
      <MobileUserDetails
        selectedUser={selectedUser}
        loading={loading}
        loadingAction={actions.loadingAction}
        activityFilter={activityFilter}
        setActivityFilter={setActivityFilter}
        loadingActivities={loadingActivities}
        filteredActivities={filteredActivities}
        toggleAdminUser={actions.toggleAdminUser}
        setToggleAdminUser={actions.setToggleAdminUser}
        onSendEmailVerification={actions.handleSendEmailVerification}
        onSendPayoutReminder={actions.handleSendPayoutReminder}
        onToggleAdminStatus={actions.handleToggleAdminStatus}
      />
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="p-4 pt-4 space-y-4">
        <AdminSubpageHeader
          title="Users"
          description="View user accounts and their subscription/payout setup status."
        />

        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {filtered.length} of {users.length} users
            </div>
            <Input
              placeholder="Search by email or username"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <ColumnSelector
              columns={columns}
              visibleColumns={visibleColumns}
              draggedColumnId={draggedColumnId}
              setDraggedColumnId={setDraggedColumnId}
              dragOverColumnId={dragOverColumnId}
              setDragOverColumnId={setDragOverColumnId}
              toggleColumn={toggleColumn}
              reorderColumn={reorderColumn}
            />
          </div>

          {actions.status && (
            <div className={`text-sm ${
              actions.status.type === 'success' ? 'text-emerald-500' :
              actions.status.type === 'warning' ? 'text-amber-500' :
              'text-destructive'
            }`}>
              <div>{actions.status.message}</div>
              {actions.status.details && (
                <div className="mt-1 text-xs opacity-80">{actions.status.details}</div>
              )}
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon name="Loader" />
              Loading users...
            </div>
          )}

          {error && (
            <Card className="border-orange-500/30 bg-orange-500/10">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Icon name="AlertTriangle" size={20} className="text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="text-sm font-medium text-orange-700 dark:text-orange-400">{error}</div>
                    {errorDetails && (
                      <>
                        <pre className="text-xs bg-background/50 rounded p-2 overflow-x-auto max-h-40 text-muted-foreground border">
                          {errorDetails}
                        </pre>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText(errorDetails);
                            setCopiedError(true);
                            setTimeout(() => setCopiedError(false), 2000);
                          }}
                        >
                          {copiedError ? (
                            <>
                              <Icon name="CheckCircle2" size={12} className="mr-1" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Icon name="Copy" size={12} className="mr-1" />
                              Copy Error
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && !error && (
            <>
              <UsersTable
                activeColumns={activeColumns}
                sorted={sorted}
                sortBy={sortBy}
                moveColumn={moveColumn}
                handleSort={handleSort}
                onUserSelect={handleUserSelect}
              />

              <UsersMobileList
                filtered={filtered}
                maxEarningsMonth={maxEarningsMonth}
                maxEarningsTotal={maxEarningsTotal}
                maxAllocatedCents={maxAllocatedCents}
                maxUnallocatedCents={maxUnallocatedCents}
                onUserSelect={handleUserSelect}
              />
            </>
          )}
        </div>

        <UserDialogs
          loadingAction={actions.loadingAction}
          deleteUserId={actions.deleteUserId}
          setDeleteUserId={actions.setDeleteUserId}
          resetUserId={actions.resetUserId}
          setResetUserId={actions.setResetUserId}
          editUsernameUser={actions.editUsernameUser}
          setEditUsernameUser={actions.setEditUsernameUser}
          newUsername={actions.newUsername}
          setNewUsername={actions.setNewUsername}
          verifyUser={actions.verifyUser}
          setVerifyUser={actions.setVerifyUser}
          toggleAdminUser={actions.toggleAdminUser}
          setToggleAdminUser={actions.setToggleAdminUser}
          onDelete={actions.handleDelete}
          onResetPassword={actions.handleResetPassword}
          onSendEmailVerification={actions.handleSendEmailVerification}
          onUsernameSave={actions.handleUsernameSave}
          onToggleAdminStatus={actions.handleToggleAdminStatus}
        />

        {/* User detail side drawer - only on desktop */}
        {isDesktop && (
          <UserDetailsDrawer
            open={!!selectedUser}
            onOpenChange={(open) => !open && setSelectedUser(null)}
            userId={selectedUser?.uid}
            username={selectedUser?.username}
            onUserClick={(userId, username) => {
              const user = users.find(u => u.uid === userId || u.username === username);
              if (user) setSelectedUser(user);
            }}
          />
        )}
      </div>
    </DndProvider>
  );
}
