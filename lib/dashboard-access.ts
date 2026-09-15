import type { DashboardRole } from './server/user-policy';

export type DashboardView = 'bookings' | 'users' | 'reports' | 'calendar-sync' | 'inventory';

export function allowedDashboardViews(role: DashboardRole, guest = false): DashboardView[] {
  if (guest) return ['bookings'];
  if (role === 'owner') return ['bookings', 'reports', 'calendar-sync', 'users', 'inventory'];
  return ['bookings', 'reports', 'inventory'];
}

export function resolveDashboardView(hash: string, role: DashboardRole, guest = false): DashboardView {
  const requested = hash.replace(/^#/, '') as DashboardView;
  return allowedDashboardViews(role, guest).includes(requested) ? requested : 'bookings';
}
