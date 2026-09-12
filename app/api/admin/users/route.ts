import { requireDashboardUser } from '@/lib/server/admin-auth';
import { AuthError } from '@/lib/server/google-identity';
import { listDashboardUsers, saveDashboardUser } from '@/lib/server/dashboard-users';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
function failure(error: unknown) {
  return Response.json({ message: error instanceof Error ? error.message : 'មិនអាចគ្រប់គ្រងអ្នកប្រើបាន' }, { status: error instanceof AuthError ? error.status : 400, headers });
}

export async function GET(request: Request) {
  try {
    await requireDashboardUser(request, 'users');
    return Response.json({ users: await listDashboardUsers() }, { headers });
  } catch (error) { return failure(error); }
}

async function save(request: Request, create: boolean) {
  try {
    const actor = await requireDashboardUser(request, 'users');
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AuthError('Invalid request', 400);
    const text = await request.text();
    if (text.length > 2000) throw new AuthError('Request too large', 413);
    const user = await saveDashboardUser(JSON.parse(text), actor.email, create);
    return Response.json({ user }, { status: create ? 201 : 200, headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) { return save(request, true); }
export async function PATCH(request: Request) { return save(request, false); }
