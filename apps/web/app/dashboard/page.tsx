import { redirect } from 'next/navigation';

/** Keep legacy /dashboard deep links without presenting a second, oversized home UI. */
export default function DashboardPage() {
  redirect('/feed');
}
