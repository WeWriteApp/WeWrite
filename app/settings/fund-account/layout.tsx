import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fund Account - WeWrite',
  description: 'Fund your WeWrite account to support creators',
};

interface FundAccountLayoutProps {
  children: React.ReactNode;
}

export default function FundAccountLayout({ children }: FundAccountLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
