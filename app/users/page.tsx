import React from 'react';
import UsersPageClient from './UsersPageClient';

/**
 * Server component for the users page
 * This renders the client component that will fetch users
 */
export default function UsersPage() {
  return <UsersPageClient />;
}