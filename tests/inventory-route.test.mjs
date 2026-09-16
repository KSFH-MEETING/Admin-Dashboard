import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (file) => ts.transpileModule(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const identity = url(`export class AuthError extends Error { constructor(message,status){super(message);this.status=status;} }
export const readCookie=()=> 'token'; export const verifyGoogleIdentity=async()=>({email:'staff@gmail.com'});
export function requireSameOrigin(request){if(request.headers.get('Origin')!=='https://example.com')throw new AuthError('Invalid origin',403);}`);
const users = url(`export const state={role:'viewer',active:true}; export async function resolveDashboardUser(){return {email:'staff@gmail.com',role:state.role,active:state.active};}`);
const env = url(`export const optionalEnv=()=> 'client-id';`);
const inventoryStore = url(`export const state={reads:0,writes:0}; export async function listInventoryItems(){state.reads++;return [];} export async function saveInventoryItem(input){state.writes++;return {itemId:'EQ-001',...input};}`);
const policy = url(compile('lib/server/user-policy.ts'));
const auth = url(compile('lib/server/admin-auth.ts')
  .replaceAll("'./env'", JSON.stringify(env))
  .replaceAll("'./google-identity'", JSON.stringify(identity))
  .replaceAll("'./dashboard-users'", JSON.stringify(users))
  .replaceAll("'./user-policy'", JSON.stringify(policy)));
const route = url(compile('app/api/admin/inventory/route.ts')
  .replaceAll("'@/lib/server/admin-auth'", JSON.stringify(auth))
  .replaceAll("'@/lib/server/google-identity'", JSON.stringify(identity))
  .replaceAll("'@/lib/server/inventory-store'", JSON.stringify(inventoryStore)));
const inventory = await import(route);
const userState = (await import(users)).state;
const storeState = (await import(inventoryStore)).state;
const input = { name: 'Projector', category: 'Display', serialNumber: 'PJ-001', acquiredDate: '2026-09-16', specification: '4K, HDMI', totalQty: 2, reservedQty: 0, inUseQty: 0, damagedQty: 0, location: 'Office', active: true, notes: '' };
const request = (method = 'GET', origin = 'https://example.com') => new Request('https://example.com/api/admin/inventory', {
  method, headers: { Origin: origin, 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify(input) }),
});

test('signed-in roles may read Inventory but only Owner may change it', async () => {
  for (const role of ['viewer', 'editor']) {
    userState.role = role;
    assert.equal((await inventory.GET(request())).status, 200);
    assert.equal((await inventory.POST(request('POST'))).status, 403);
    assert.equal((await inventory.PATCH(request('PATCH'))).status, 403);
  }
  assert.equal(storeState.writes, 0);
  userState.role = 'owner';
  assert.equal((await inventory.POST(request('POST'))).status, 201);
  assert.equal((await inventory.PATCH(request('PATCH'))).status, 200);
  assert.equal(storeState.writes, 2);
});

test('Inventory changes reject cross-origin requests', async () => {
  userState.role = 'owner';
  const writes = storeState.writes;
  assert.equal((await inventory.PATCH(request('PATCH', 'https://attacker.example'))).status, 403);
  assert.equal(storeState.writes, writes);
});
