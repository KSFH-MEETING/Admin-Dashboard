import {
  deterministicEventId,
  ensureCalendarEvent,
  getCalendarEvent,
  listBookingRows,
  listCalendarEventsForMonth,
  updateBooking,
  updateCalendarEvent,
  type GoogleCalendarEvent,
} from './google';
import type { Booking } from './types';

export type CalendarSyncSummary = {
  month: string;
  total: number;
  linked: number;
  needsSync: number;
  missingLink: number;
  missingEvent: number;
  dateMismatches: number;
};

export type CalendarSyncResult = CalendarSyncSummary & {
  processed: number;
  failed: number;
  errors: string[];
};

export function parseCalendarMonth(value: unknown) {
  const month = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('សូមជ្រើសរើសខែត្រឹមត្រូវ');
  return month;
}

function eventDateTime(event: GoogleCalendarEvent, part: 'start' | 'end') {
  return String(event[part]?.dateTime || event[part]?.date || '').slice(0, 16);
}

function clean(value: string | undefined) {
  return String(value || '').normalize('NFKC').replace(/^[^\p{L}\p{N}]+/u, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function eventMatchesBooking(event: GoogleCalendarEvent, booking: Booking) {
  return event.status !== 'cancelled'
    && eventDateTime(event, 'start') === `${booking.date}T${booking.startTime}`
    && eventDateTime(event, 'end') === `${booking.date}T${booking.endTime}`;
}

function findReusableEvent(events: GoogleCalendarEvent[], booking: Booking) {
  return events.find((event) => event.id && event.extendedProperties?.private?.requestId === booking.requestId)
    || events.find((event) => event.id
      && eventMatchesBooking(event, booking)
      && clean(event.summary) === clean(booking.title)
      && clean(event.location) === clean(booking.room));
}

async function stateForMonth(month: string) {
  const [rows, events] = await Promise.all([listBookingRows(), listCalendarEventsForMonth(month)]);
  const bookings = rows.filter(({ booking }) => booking.status !== 'CANCELED' && booking.date.startsWith(`${month}-`));
  const eventsById = new Map(events.filter((event) => event.id).map((event) => [event.id as string, event]));
  const states = bookings.map((item) => {
    const event = item.booking.googleEventId ? eventsById.get(item.booking.googleEventId) : undefined;
    const reason = !item.booking.googleEventId ? 'missing-link' : !event ? 'missing-event' : !eventMatchesBooking(event, item.booking) ? 'date-mismatch' : 'linked';
    return { ...item, reason } as const;
  });
  const summary: CalendarSyncSummary = {
    month,
    total: states.length,
    linked: states.filter((item) => item.reason === 'linked').length,
    needsSync: states.filter((item) => item.reason !== 'linked').length,
    missingLink: states.filter((item) => item.reason === 'missing-link').length,
    missingEvent: states.filter((item) => item.reason === 'missing-event').length,
    dateMismatches: states.filter((item) => item.reason === 'date-mismatch').length,
  };
  return { summary, states, events };
}

export async function checkCalendarMonth(monthValue: unknown) {
  return (await stateForMonth(parseCalendarMonth(monthValue))).summary;
}

export async function syncCalendarMonth(monthValue: unknown, batchSize = 10): Promise<CalendarSyncResult> {
  const month = parseCalendarMonth(monthValue);
  const { summary, states, events } = await stateForMonth(month);
  const pending = states.filter((item) => item.reason !== 'linked').slice(0, Math.max(1, Math.min(batchSize, 10)));
  const errors: string[] = [];
  let processed = 0;

  for (const { booking: original, rowNumber } of pending) {
    const booking = { ...original, updatedAt: new Date().toISOString(), error: '' };
    try {
      if (booking.googleEventId) {
        const existing = await getCalendarEvent(booking.googleEventId);
        const belongsToBooking = existing?.extendedProperties?.private?.requestId === booking.requestId || (existing && eventMatchesBooking(existing, booking));
        if (belongsToBooking) await updateCalendarEvent(booking);
        else {
          booking.googleEventId = await deterministicEventId(booking.requestId);
          booking.googleEventId = await ensureCalendarEvent(booking);
        }
      } else {
        const reusable = findReusableEvent(events, booking);
        if (reusable?.id) {
          booking.googleEventId = reusable.id;
          await updateCalendarEvent(booking);
        }
        else {
          booking.googleEventId = await deterministicEventId(booking.requestId);
          booking.googleEventId = await ensureCalendarEvent(booking);
        }
      }
      await updateBooking(rowNumber, booking);
      processed += 1;
    } catch (error) {
      errors.push(`${booking.bookingId}: ${error instanceof Error ? error.message : 'មានបញ្ហា'}`);
    }
  }

  return {
    ...summary,
    linked: summary.linked + processed,
    needsSync: Math.max(0, summary.needsSync - processed),
    processed,
    failed: errors.length,
    errors: errors.slice(0, 5),
  };
}
