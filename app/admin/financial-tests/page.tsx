import { redirect } from 'next/navigation';

export default function FinancialTestsRedirectPage() {
  redirect('/admin/writer-payouts');
}
