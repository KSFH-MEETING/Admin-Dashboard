import { calendarEventBody } from './calendar-event';
import { optionalEnv, requiredEnv } from './env';
import { bookingToRow, rowToBooking, SHEET_HEADERS, type Booking } from './types';

type TokenCache = { token: string; expiresAt: number } | null;
let tokenCache: TokenCache = null;
let sheetReady = false;

function base64Url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemBytes(pem: string): Uint8Array {
  const body = pem.replace(/\\n/g, '\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(body);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: requiredEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const privateKey = pemBytes(requiredEnv('GOOGLE_PRIVATE_KEY'));
  const key = await crypto.subtle.importKey(
    'pkcs8', privateKey.buffer.slice(privateKey.byteOffset, privateKey.byteOffset + privateKey.byteLength) as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const result = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !result.access_token) throw new Error(result.error_description || 'Google authentication failed');
  tokenCache = { token: result.access_token, expiresAt: Date.now() + (result.expires_in || 3600) * 1000 };
  return result.access_token;
}

export async function googleFetch(url: string, init?: RequestInit, accepted: number[] = []): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${await accessToken()}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(url, {
    ...init,
    headers,
  });
  if (!response.ok && !accepted.includes(response.status)) {
    const body = await response.text();
    let message = body;
    try { message = (JSON.parse(body) as { error?: { message?: string } }).error?.message || body; } catch { /* text response */ }
    throw new Error(`Google API: ${message || response.statusText}`);
  }
  return response;
}

const sheetId = () => requiredEnv('GOOGLE_SHEET_ID');
const sheetName = () => optionalEnv('GOOGLE_SHEET_NAME') || 'Bookings';
const sheetRange = (range: string) => encodeURIComponent(`'${sheetName().replace(/'/g, "''")}'!${range}`);

export async function ensureBookingSheet() {
  if (sheetReady) return;
  const id = sheetId();
  const metadata = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}?fields=sheets.properties.title`);
  const data = await metadata.json() as { sheets?: { properties?: { title?: string } }[] };
  if (!data.sheets?.some((sheet) => sheet.properties?.title === sheetName())) {
    await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}:batchUpdate`, {
      method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName(), gridProperties: { frozenRowCount: 1 } } } }] }),
    });
  }
  const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${sheetRange('A1:W1')}?valueInputOption=RAW`;
  await googleFetch(headerUrl, { method: 'PUT', body: JSON.stringify({ values: [[...SHEET_HEADERS]] }) });
  sheetReady = true;
}

export async function listBookings(): Promise<Booking[]> {
  await ensureBookingSheet();
  const response = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId())}/values/${sheetRange('A2:W')}`);
  const result = await response.json() as { values?: unknown[][] };
  return (result.values || []).filter((row) => row[0]).map(rowToBooking);
}

export async function findBooking(value: string, key: 'bookingId' | 'requestId' = 'bookingId') {
  const bookings = await listBookings();
  const booking = bookings.find((item) => item[key] === value) || null;
  return { booking, rowNumber: booking ? bookings.findIndex((item) => item[key] === value) + 2 : -1 };
}

export async function appendBooking(booking: Booking) {
  await ensureBookingSheet();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId())}/values/${sheetRange('A:W')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  await googleFetch(url, { method: 'POST', body: JSON.stringify({ values: [bookingToRow(booking)] }) });
}

export async function updateBooking(rowNumber: number, booking: Booking) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId())}/values/${sheetRange(`A${rowNumber}:W${rowNumber}`)}?valueInputOption=RAW`;
  await googleFetch(url, { method: 'PUT', body: JSON.stringify({ values: [bookingToRow(booking)] }) });
}

export async function deterministicEventId(requestId: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(requestId));
  return Array.from(new Uint8Array(digest).slice(0, 20), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function calendarUrl(eventId = '') {
  const calendar = encodeURIComponent(requiredEnv('GOOGLE_CALENDAR_ID'));
  return `https://www.googleapis.com/calendar/v3/calendars/${calendar}/events${eventId ? `/${encodeURIComponent(eventId)}` : ''}`;
}

export async function ensureCalendarEvent(booking: Booking) {
  const response = await googleFetch(calendarUrl(), { method: 'POST', body: JSON.stringify(calendarEventBody(booking)) }, [409]);
  if (response.status === 409) return booking.googleEventId;
  const result = await response.json() as { id?: string };
  return result.id || booking.googleEventId;
}

export async function updateCalendarEvent(booking: Booking) {
  await googleFetch(calendarUrl(booking.googleEventId), { method: 'PUT', body: JSON.stringify(calendarEventBody(booking)) });
}

export async function cancelCalendarEvent(eventId: string) {
  if (!eventId) return;
  await googleFetch(calendarUrl(eventId), { method: 'DELETE' }, [404, 410]);
}

export async function refreshCalendarEventStyle(booking: Booking) {
  const { summary, description } = calendarEventBody(booking);
  // Patch presentation only; preserve dates, participants and all other fields.
  await googleFetch(calendarUrl(booking.googleEventId), { method: 'PATCH', body: JSON.stringify({ summary, description }) });
}
