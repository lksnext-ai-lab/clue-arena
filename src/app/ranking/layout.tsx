import { DashboardShell } from '@/components/layout/DashboardShell';

/**
 * F011 — Ranking del evento en tiempo real
 * Public layout: no authentication required (CA3 / OPENQ-014).
 * Route is already whitelisted in middleware PUBLIC_PATHS.
 */
export default function RankingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-slate-900 text-white">
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
