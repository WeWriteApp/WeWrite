/**
 * Legacy /user/[id] layout - minimal layout for redirect page
 *
 * The actual page.tsx handles redirects to the new /u/[username] route
 */

interface UserLayoutProps {
  children: React.ReactNode;
}

export default function LegacyUserLayout({ children }: UserLayoutProps) {
  return <>{children}</>;
}
