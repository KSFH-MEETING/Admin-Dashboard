import { requireDashboardUser } from '@/lib/server/admin-auth';
import { AuthError } from '@/lib/server/google-identity';
import {
  listInventoryItems,
  saveInventoryItem,
} from '@/lib/server/inventory-store';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

function failure(error: unknown) {
  return Response.json(
    { message: error instanceof Error ? error.message : 'មិនអាចគ្រប់គ្រងសម្ភារៈបាន' },
    { status: error instanceof AuthError ? error.status : 400, headers },
  );
}

export async function GET(request: Request) {
  try {
    await requireDashboardUser(request, 'read');
    return Response.json({ items: await listInventoryItems() }, { headers });
  } catch (error) {
    return failure(error);
  }
}

async function save(request: Request, create: boolean) {
  try {
    const actor = await requireDashboardUser(request, 'inventory');
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new AuthError('Invalid request', 400);
    const body = await request.text();
    if (body.length > 5000) throw new AuthError('Request too large', 413);
    const item = await saveInventoryItem(JSON.parse(body), actor.email, create);
    return Response.json({ item }, { status: create ? 201 : 200, headers });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  return save(request, true);
}
export async function PATCH(request: Request) {
  return save(request, false);
}
