import { auth } from '../firebase/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata = {
  title: 'Fix Activity Calendar',
  description: 'Update your activity calendar to reflect your actual writing activity',
};

export default async function BackfillLayout({ children }) {
  // Check if user is authenticated
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <div className="container mx-auto py-4 px-4 flex items-center">
          <Link href="/" className="text-neutral-800 dark:text-neutral-200 hover:text-neutral-600 dark:hover:text-neutral-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="ml-4 text-lg font-medium">Fix Activity Calendar</h1>
        </div>
      </header>

      <main className="py-6">
        {children}
      </main>
    </div>
  );
}
