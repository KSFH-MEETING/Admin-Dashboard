import { createBooking, ConflictError } from '@/lib/server/booking-service';
import { isConfigured } from '@/lib/server/env';

export async function POST(request: Request) {
  if (!isConfigured()) return Response.json({ message: 'Backend មិនទាន់បានភ្ជាប់ Google Service Account' }, { status: 503 });
  try {
    const booking = await createBooking(await request.json());
    return Response.json({ bookingId: booking.bookingId, status: booking.status, message: 'បានបញ្ជាក់ការកក់បន្ទប់' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'មិនអាចបង្កើតការកក់បាន';
    const status = error instanceof ConflictError ? 409 : message.includes('មិនត្រឹមត្រូវ') || message.includes('សូមបំពេញ') || message.includes('ម៉ោង') ? 400 : 502;
    return Response.json({ message }, { status });
  }
}
