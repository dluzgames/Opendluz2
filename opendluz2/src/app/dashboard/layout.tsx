import { env } from '@/lib/env';
import db from '@/lib/db';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const auth = cookieStore.get('dashboard_auth');

  if (auth?.value !== env.DASHBOARD_PASSWORD) {
    // Basic password prompt for the sake of this implementation
    // In a real app, this would be a proper login page
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans">
      <header className="border-b border-slate-800 p-4 flex justify-between items-center bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-xl font-bold tracking-tight text-indigo-400">OpenDluz Dashboard</h1>
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span>Status: <span className="text-emerald-400 font-medium">Online</span></span>
        </div>
      </header>
      <main className="p-6">
        {children}
      </main>
    </div>
  );
}
