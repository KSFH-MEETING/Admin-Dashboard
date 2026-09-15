export type DashboardRole = 'owner' | 'editor' | 'viewer';
export type DashboardUser = { email: string; name: string; role: DashboardRole; active: boolean; updatedAt: string; updatedBy: string };
export type UserInput = { email: string; name: string; role: 'editor' | 'viewer'; active: boolean };

export function normalizeEmail(value: string) { return value.trim().toLowerCase(); }

export function parseUserInput(value: unknown): UserInput {
  if (!value || typeof value !== 'object') throw new Error('សូមបំពេញព័ត៌មានអ្នកប្រើ');
  const data = value as Record<string, unknown>;
  const email = typeof data.email === 'string' ? normalizeEmail(data.email) : '';
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email មិនត្រឹមត្រូវ');
  if (!name || name.length > 100) throw new Error('សូមបញ្ចូលឈ្មោះមិនលើស 100 តួអក្សរ');
  if (data.role !== 'viewer' && data.role !== 'editor') throw new Error('សិទ្ធិមិនត្រឹមត្រូវ');
  if (typeof data.active !== 'boolean') throw new Error('ស្ថានភាពមិនត្រឹមត្រូវ');
  return { email, name, role: data.role, active: data.active };
}

export function userCan(user: Pick<DashboardUser, 'active' | 'role'>, permission: 'read' | 'bookings' | 'users' | 'inventory') {
  if (!user.active) return false;
  if (permission === 'users' || permission === 'inventory') return user.role === 'owner';
  if (permission === 'bookings') return user.role === 'owner' || user.role === 'editor';
  return permission === 'read' && ['owner', 'editor', 'viewer'].includes(user.role);
}

// Append order is authoritative, so a later disable record revokes access even
// for an already signed-in user. No client-provided timestamps determine roles.
export function usersFromRows(rows: unknown[][]): DashboardUser[] {
  const users = new Map<string, DashboardUser>();
  for (const row of rows) {
    if (typeof row[0] !== 'string' || !row[0].trim()) continue;
    const email = normalizeEmail(row[0]);
    const validRole = row[2] === 'viewer' || row[2] === 'editor';
    users.set(email, {
      email, name: typeof row[1] === 'string' ? row[1] : email,
      role: row[2] === 'editor' ? 'editor' : 'viewer',
      active: validRole && (row[3] === true || row[3] === 'TRUE'),
      updatedAt: typeof row[4] === 'string' ? row[4] : '',
      updatedBy: typeof row[5] === 'string' ? row[5] : '',
    });
  }
  return [...users.values()];
}
