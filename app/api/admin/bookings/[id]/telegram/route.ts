import { NotFoundError, retryBookingTelegramById } from '@/lib/server/booking-service';
import { requireAdmin } from '@/lib/server/admin-auth';
import { AuthError } from '@/lib/server/google-identity';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    return Response.json({ booking: await retryBookingTelegramById(decodeURIComponent(id)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'មិនអាច Sync Telegram បាន';
    const status = error instanceof AuthError ? error.status : error instanceof NotFoundError ? 404 : 502;
    return Response.json({ message }, { status });
  }
}
