import { optionalEnv, requiredEnv } from './env';
import { googleFetch } from './google';
import { AuthError } from './google-identity';
import { normalizeEmail, parseUserInput, usersFromRows, type DashboardUser } from './user-policy';

const USERS_SHEET = 'DashboardUsers';
const HEADERS = ['Email', 'Name', 'Role', 'Active', 'Changed At', 'Changed By'];
const api = () => `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(requiredEnv('GOOGLE_SHEET_ID'))}`;
let initialization: Promise<void> | undefined;

export function ownerEmails() { return optionalEnv('ADMIN_EMAILS').split(',').map(normalizeEmail).filter(Boolean); }
function ownerUser(email: string): DashboardUser {
  return { email, name: 'KSFH-MEETING', role: 'owner', active: true, updatedAt: '', updatedBy: '' };
}

async function initializeUsers() {
  const metadata = await googleFetch(`${api()}?fields=sheets.properties.title`);
  const data = await metadata.json() as { sheets?: { properties: { title: string } }[] };
  if (data.sheets?.some((sheet) => sheet.properties.title === USERS_SHEET)) return;
  // Create the tab and header atomically; never rewrite an existing user's row.
  const sheetId = 1_000_000 + crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000_000;
  try {
    await googleFetch(`${api()}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: [
      { addSheet: { properties: { sheetId, title: USERS_SHEET, gridProperties: { frozenRowCount: 1 } } } },
      { updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 0 }, rows: [{ values: HEADERS.map((value) => ({ userEnteredValue: { stringValue: value } })) }], fields: 'userEnteredValue' } },
    ] }) });
  } catch (error) {
    // Another Worker may have initialized the shared sheet concurrently.
    const retry = await googleFetch(`${api()}?fields=sheets.properties.title`);
    const result = await retry.json() as { sheets?: { properties: { title: string } }[] };
    if (!result.sheets?.some((sheet) => sheet.properties.title === USERS_SHEET)) throw error;
  }
}

async function ensureUsers() {
  initialization ??= initializeUsers().catch((error) => { initialization = undefined; throw error; });
  await initialization;
}

async function storedUsers() {
  await ensureUsers();
  const response = await googleFetch(`${api()}/values/${encodeURIComponent(`'${USERS_SHEET}'!A2:F`)}`);
  const data = await response.json() as { values?: unknown[][] };
  return usersFromRows(data.values || []);
}

export async function listDashboardUsers() {
  const owners = ownerEmails();
  const users = await storedUsers();
  return [...owners.map(ownerUser), ...users.filter((user) => !owners.includes(user.email))];
}

export async function resolveDashboardUser(email: string): Promise<DashboardUser> {
  email = normalizeEmail(email);
  if (ownerEmails().includes(email)) return ownerUser(email);
  // Deliberately read current permissions on every request, including sessions.
  const user = (await storedUsers()).find((item) => item.email === email);
  if (!user?.active) throw new AuthError('គណនីនេះមិនមានសិទ្ធិចូល Dashboard ឬត្រូវបានបិទ', 403);
  return user;
}

export async function saveDashboardUser(raw: unknown, actor: string, create: boolean) {
  if (!ownerEmails().includes(normalizeEmail(actor))) throw new AuthError('មានតែម្ចាស់ប្រព័ន្ធអាចគ្រប់គ្រងអ្នកប្រើ', 403);
  const input = parseUserInput(raw);
  if (ownerEmails().includes(input.email)) throw new AuthError('មិនអាចកែសិទ្ធិ ឬបិទម្ចាស់ប្រព័ន្ធបាន', 403);
  const exists = (await storedUsers()).some((user) => user.email === input.email);
  if (create && exists) throw new AuthError('Email នេះមានរួចហើយ។ សូមកែអ្នកប្រើដែលមានស្រាប់', 409);
  if (!create && !exists) throw new AuthError('រកមិនឃើញអ្នកប្រើនេះ', 404);
  const user = { ...input, updatedAt: new Date().toISOString(), updatedBy: actor };
  await googleFetch(`${api()}/values/${encodeURIComponent(`'${USERS_SHEET}'!A:F`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST', body: JSON.stringify({ values: [[user.email, user.name, user.role, user.active, user.updatedAt, actor]] }),
  });
  return user;
}
