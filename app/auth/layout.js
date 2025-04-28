export const metadata = {
  title: 'WeWrite - Account Access',
  description: 'Sign in or create an account for WeWrite collaborative writing platform',
};

export default function AuthLayout({ children }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      {children}
    </div>
  );
}
