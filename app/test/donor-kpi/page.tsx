"use client";

import React from 'react';
import SidebarLayout from '../../components/layout/SidebarLayout';
import UserDonorKPITest from '../../components/test/UserDonorKPITest';

export default function DonorKPITestPage() {
  return (
    <SidebarLayout>
      <div className="container mx-auto py-8">
        <UserDonorKPITest />
      </div>
    </SidebarLayout>
  );
}
