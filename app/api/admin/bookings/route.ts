import { requireAdmin } from '@/lib/server/admin-auth';
import { isConfigured } from '@/lib/server/env';
import { listBookings } from '@/lib/server/google';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    if (!isConfigured()) return Response.json({ bookings: [], configured: false });
    const bookings = (await listBookings()).sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`));
    return Response.json({ bookings, configured: true });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : 'គ្មានសិទ្ធិ' }, { status: 401 });
  }
}
