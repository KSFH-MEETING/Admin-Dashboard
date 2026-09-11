import { DEPARTMENTS, EQUIPMENT, ROOMS, TECHNICAL_STAFF, TIME_ZONE } from '@/lib/meeting-config';
import type { BookingInput } from './types';

const clean = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const list = (value: unknown, allowed: readonly string[]) => Array.isArray(value)
  ? [...new Set(value.map((item) => clean(item, 120)).filter((item) => allowed.includes(item)))]
  : [];

export function validateBookingInput(raw: unknown): BookingInput {
  if (!raw || typeof raw !== 'object') throw new Error('ទិន្នន័យមិនត្រឹមត្រូវ');
  const data = raw as Record<string, unknown>;
  const input: BookingInput = {
    requestId: clean(data.requestId, 80), title: clean(data.title, 250),
    coordinator: clean(data.coordinator, 150), phone: clean(data.phone, 40),
    department: clean(data.department, 180), room: clean(data.room, 120),
    date: clean(data.date, 10), startTime: clean(data.startTime, 5), endTime: clean(data.endTime, 5),
    attendees: Math.max(0, Math.min(10000, Number(data.attendees) || 0)),
    technicalStaff: list(data.technicalStaff, TECHNICAL_STAFF), equipment: list(data.equipment, EQUIPMENT),
    notes: clean(data.notes, 2000), timeZone: TIME_ZONE, source: clean(data.source, 40) || 'public-web',
    telegramInitData: clean(data.telegramInitData, 10000),
  };

  if (!/^[0-9a-f-]{16,80}$/i.test(input.requestId)) throw new Error('លេខសម្គាល់សំណើមិនត្រឹមត្រូវ');
  if (!input.title || !input.coordinator || !input.department || !input.room) throw new Error('សូមបំពេញព័ត៌មានចាំបាច់ទាំងអស់');
  if (!(DEPARTMENTS as readonly string[]).includes(input.department)) throw new Error('ផ្នែកស្នើសុំមិនត្រឹមត្រូវ');
  if (!(ROOMS as readonly string[]).includes(input.room)) throw new Error('បន្ទប់មិនត្រឹមត្រូវ');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.startTime) || !/^\d{2}:\d{2}$/.test(input.endTime)) throw new Error('កាលបរិច្ឆេទ ឬម៉ោងមិនត្រឹមត្រូវ');
  if (input.startTime >= input.endTime) throw new Error('ម៉ោងបញ្ចប់ត្រូវតែក្រោយម៉ោងចាប់ផ្តើម');
  return input;
}

export function overlaps(a: Pick<BookingInput, 'date' | 'room' | 'startTime' | 'endTime'>, b: Pick<BookingInput, 'date' | 'room' | 'startTime' | 'endTime'>) {
  return a.date === b.date && a.room === b.room && a.startTime < b.endTime && a.endTime > b.startTime;
}
