import { optionalEnv, requiredEnv } from './env';
import type { Booking } from './types';

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function bookingMessage(booking: Booking, action: 'new' | 'updated' | 'canceled') {
  const heading = action === 'new' ? '✅ បានបញ្ជាក់ការកក់បន្ទប់' : action === 'updated' ? '✏️ បានកែប្រែការកក់បន្ទប់' : '❌ បានលុបចោលការកក់បន្ទប់';
  const lines = [
    `<b>${heading}</b>`, '', `<b>${escapeHtml(booking.title)}</b>`,
    `🆔 ${escapeHtml(booking.bookingId)}`, `📍 ${escapeHtml(booking.room)}`,
    `📅 ${escapeHtml(booking.date)} · ${escapeHtml(booking.startTime)}–${escapeHtml(booking.endTime)}`,
    `👤 ${escapeHtml(booking.coordinator)}`, `🏥 ${escapeHtml(booking.department)}`,
    booking.phone ? `☎️ ${escapeHtml(booking.phone)}` : '',
    booking.attendees ? `👥 ${booking.attendees} នាក់` : '',
    booking.technicalStaff.length ? `🧑‍💻 ${escapeHtml(booking.technicalStaff.join(', '))}` : '',
    booking.equipment.length ? `🧰 ${escapeHtml(booking.equipment.join(', '))}` : '',
    booking.notes ? `📝 ${escapeHtml(booking.notes)}` : '',
  ];
  return lines.filter((line, index) => line || index === 1).join('\n');
}

async function telegram(method: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${requiredEnv('TELEGRAM_BOT_TOKEN')}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json() as { ok?: boolean; result?: { message_id?: number }; description?: string };
  if (!response.ok || !result.ok) throw new Error(`Telegram: ${result.description || response.statusText}`);
  return result;
}

export async function sendBookingMessage(booking: Booking) {
  if (!optionalEnv('TELEGRAM_BOT_TOKEN') || !optionalEnv('TELEGRAM_CHAT_ID')) return '';
  const body: Record<string, unknown> = {
    chat_id: requiredEnv('TELEGRAM_CHAT_ID'), text: bookingMessage(booking, 'new'), parse_mode: 'HTML',
  };
  const topicId = optionalEnv('TELEGRAM_TOPIC_ID');
  if (topicId) body.message_thread_id = Number(topicId);
  const result = await telegram('sendMessage', body);
  return String(result.result?.message_id || '');
}

export async function updateBookingMessage(booking: Booking, action: 'updated' | 'canceled') {
  if (!optionalEnv('TELEGRAM_BOT_TOKEN') || !optionalEnv('TELEGRAM_CHAT_ID')) return booking.telegramMessageId;
  if (booking.telegramMessageId) {
    await telegram('editMessageText', {
      chat_id: requiredEnv('TELEGRAM_CHAT_ID'), message_id: Number(booking.telegramMessageId),
      text: bookingMessage(booking, action), parse_mode: 'HTML',
    });
    return booking.telegramMessageId;
  }
  const body: Record<string, unknown> = {
    chat_id: requiredEnv('TELEGRAM_CHAT_ID'), text: bookingMessage(booking, action), parse_mode: 'HTML',
  };
  const topicId = optionalEnv('TELEGRAM_TOPIC_ID');
  if (topicId) body.message_thread_id = Number(topicId);
  const result = await telegram('sendMessage', body);
  return String(result.result?.message_id || '');
}

async function hmac(key: Uint8Array, data: string) {
  const keyBuffer = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
  const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data)));
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyTelegramInitData(initData: string) {
  if (!initData) return '';
  const token = optionalEnv('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error('Telegram Mini App មិនទាន់បានកំណត់');
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash') || '';
  const authDate = Number(params.get('auth_date') || 0);
  if (!receivedHash || !authDate || Math.abs(Date.now() / 1000 - authDate) > 86_400) throw new Error('Telegram session ផុតកំណត់ សូមបើក Form ម្តងទៀត');
  const entries = [...params.entries()].filter(([key]) => key !== 'hash' && key !== 'signature').sort(([a], [b]) => a.localeCompare(b));
  const checkString = entries.map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = await hmac(new TextEncoder().encode('WebAppData'), token);
  const calculated = hex(await hmac(secret, checkString));
  if (calculated.length !== receivedHash.length || !calculated.split('').every((char, index) => char === receivedHash[index])) throw new Error('Telegram session មិនត្រឹមត្រូវ');
  try {
    const user = JSON.parse(params.get('user') || '{}') as { id?: number };
    return user.id ? String(user.id) : '';
  } catch { return ''; }
}
