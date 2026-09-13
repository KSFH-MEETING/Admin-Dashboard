import { checkCalendarMonth, parseCalendarMonth, syncCalendarMonth } from '@/lib/server/calendar-sync';
import { requireDashboardUser } from '@/lib/server/admin-auth';
import { AuthError } from '@/lib/server/google-identity';

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'មានបញ្ហាមិនស្គាល់';
  return Response.json({ message }, { status: error instanceof AuthError ? error.status : 502, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  try {
    await requireDashboardUser(request, 'users');
    const month = parseCalendarMonth(new URL(request.url).searchParams.get('month'));
    return Response.json(await checkCalendarMonth(month), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    await requireDashboardUser(request, 'users');
    const body = await request.json() as { month?: unknown };
    return Response.json(await syncCalendarMonth(body.month), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
