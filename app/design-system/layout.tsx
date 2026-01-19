/**
 * Design System Layout
 *
 * Forces dynamic rendering for the design system page since it uses
 * client-side interactive features that can't be statically generated.
 */

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function DesignSystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
