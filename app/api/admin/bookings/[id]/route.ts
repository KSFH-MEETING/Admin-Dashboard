import { cancelBookingById, ConflictError, NotFoundError, updateBookingById } from '@/lib/server/booking-service';
import { AuthError } from '@/lib/server/google-identity';
import { requireAdmin } from '@/lib/server/admin-auth';

type Context = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'មានបញ្ហាមិនស្គាល់';
  const status = error instanceof AuthError ? error.status : error instanceof ConflictError ? 409 : error instanceof NotFoundError ? 404 : 502;
  return Response.json({ message }, { status });
}

export async function PATCH(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    return Response.json({ booking: await updateBookingById(decodeURIComponent(id), await request.json()) });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    return Response.json({ booking: await cancelBookingById(decodeURIComponent(id)) });
  } catch (error) { return errorResponse(error); }
}
