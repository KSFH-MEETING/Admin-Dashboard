import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (file) => ts.transpileModule(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const identity = url(`export class AuthError extends Error { constructor(message, status) { super(message); this.status = status; } }
export const readCookie = () => 'token'; export const verifyGoogleIdentity = async () => ({ email:'staff@gmail.com' });
export function requireSameOrigin(request) { if (request.headers.get('Origin') !== 'https://example.com') throw new AuthError('Invalid origin',403); }`);
const store = url(`import { AuthError } from '${identity}'; export const state = { role:'viewer', active:true, fail:false, reads:0, writes:0 };
export async function resolveDashboardUser() { if(state.fail) throw new Error('upstream unavailable'); if(!state.active) throw new AuthError('Disabled',403); return {email:'staff@gmail.com', role:state.role, active:state.active}; }
export async function listDashboardUsers() { state.reads++; return []; }
export async function saveDashboardUser(input) { state.writes++; return input; }`);
const env = url(`export const optionalEnv = () => 'client-id';`);
const calendarSyncService = url(`export const parseCalendarMonth = () => '2026-01'; export const checkCalendarMonth = async () => ({month:'2026-01'}); export const syncCalendarMonth = async () => ({month:'2026-01',processed:1});`);
const policy = url(compile('lib/server/user-policy.ts'));
const auth = url(compile('lib/server/admin-auth.ts').replaceAll("'./env'", JSON.stringify(env)).replaceAll("'./google-identity'", JSON.stringify(identity)).replaceAll("'./dashboard-users'", JSON.stringify(store)).replaceAll("'./user-policy'", JSON.stringify(policy)));
function route(file) { return url(compile(file).replaceAll("'@/lib/server/admin-auth'", JSON.stringify(auth)).replaceAll("'@/lib/server/google-identity'", JSON.stringify(identity)).replaceAll("'@/lib/server/dashboard-users'", JSON.stringify(store)).replaceAll("'@/lib/server/calendar-sync'", JSON.stringify(calendarSyncService))); }
const { state } = await import(store);
const users = await import(route('app/api/admin/users/route.ts'));
const sessions = await import(route('app/api/auth/session/route.ts'));
const calendarSync = await import(route('app/api/admin/calendar-sync/route.ts'));
const { requireAdmin } = await import(auth);
const { userCan } = await import(policy);
const request = (method='GET', origin='https://example.com') => new Request('https://example.com/api/admin/users', {method, headers:{Origin:origin,'Content-Type':'application/json'}, ...(method==='GET'?{}:{body:JSON.stringify({name:'Staff',email:'staff@gmail.com',role:'editor',active:true})})});

test('actual admin routes reject viewer/editor user management before reading or writing', async () => {
  for (const role of ['viewer','editor']) {
    state.role=role; state.active=true; state.fail=false; state.reads=0; state.writes=0;
    for (const method of ['GET','POST','PATCH']) assert.equal((await users[method](request(method))).status,403);
    assert.equal((await calendarSync.GET(request())).status,403);
    assert.equal((await calendarSync.POST(request('POST'))).status,403);
    assert.equal(state.reads,0); assert.equal(state.writes,0);
    if (role==='viewer') await assert.rejects(()=>requireAdmin(request('PATCH')),e=>e.status===403);
    else assert.equal(await requireAdmin(request('PATCH')),'staff@gmail.com');
  }
});
test('owner access remains available but cross-origin writes and disabled access are rejected', async () => {
  state.role='owner'; state.active=true;
  assert.equal((await users.GET(request())).status,200);
  assert.equal((await users.POST(request('POST'))).status,201);
  assert.equal((await calendarSync.GET(request())).status,200);
  assert.equal((await calendarSync.POST(request('POST'))).status,200);
  const writes=state.writes;
  assert.equal((await users.PATCH(request('PATCH','https://attacker.example'))).status,403);
  assert.equal((await calendarSync.POST(request('POST','https://attacker.example'))).status,403);
  assert.equal(state.writes,writes);
  state.active=false;
  const denied=await sessions.GET(request()); assert.equal((await denied.json()).reason,'forbidden');
  await assert.rejects(()=>requireAdmin(request()),e=>e.status===403);
});
test('permission service outages differ from denied access and unknown permissions fail closed', async () => {
  state.active=true; state.fail=true;
  assert.equal((await sessions.GET(request())).status,503);
  state.fail=false;
  assert.equal(userCan({role:'viewer',active:true},'unknown-permission'),false);
});
