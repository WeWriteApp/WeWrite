import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WeWrite - Account Access',
  description: 'Sign in or create an account for WeWrite collaborative writing platform',
};

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      {children}
    </div>
  );
}
