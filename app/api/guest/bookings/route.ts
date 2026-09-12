import { isConfigured } from '@/lib/server/env';
import { listBookings } from '@/lib/server/google';
import { publicBooking } from '@/lib/server/public-booking';

const headers = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

export async function GET() {
  try {
    if (!isConfigured()) return Response.json({ bookings: [], configured: false }, { headers });
    const bookings = (await listBookings())
      .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`))
      .map(publicBooking);
    return Response.json({ bookings, configured: true }, { headers });
  } catch {
    return Response.json({ message: 'មិនអាចអានព័ត៌មានការកក់បាន។ សូមព្យាយាមម្ដងទៀត។' }, { status: 502, headers });
  }
}
