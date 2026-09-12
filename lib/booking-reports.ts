import type { Booking } from './server/types.ts';

export const reportStatuses: Record<string, string> = { PENDING: 'កំពុងដំណើរការ', CALENDAR_CREATED: 'បានបង្កើត Calendar', CONFIRMED: 'បានបញ្ជាក់', ERROR: 'មានបញ្ហា', CANCELED: 'បានលុបចោល' };
export type ReportFilter = { from: string; to: string; room: string; status: string };
export function filterReport(bookings: Booking[], filter: ReportFilter) {
  if (filter.from && filter.to && filter.from > filter.to) return [];
  return bookings.filter((b) => (!filter.from || b.date >= filter.from) && (!filter.to || b.date <= filter.to) && (!filter.room || b.room === filter.room) && (!filter.status || b.status === filter.status)).sort((a, b) => `${a.date} ${a.startTime} ${a.bookingId}`.localeCompare(`${b.date} ${b.startTime} ${b.bookingId}`));
}
export function summarizeReport(rows: Booking[]) {
  const confirmed = rows.filter((b) => b.status === 'CONFIRMED');
  return { total: rows.length, confirmed: confirmed.length, canceled: rows.filter((b) => b.status === 'CANCELED').length, attendees: confirmed.reduce((sum, b) => sum + (Number.isFinite(b.attendees) ? Math.max(0, b.attendees) : 0), 0) };
}
function csvCell(value: string | number) {
  let text = String(value);
  // Prevent spreadsheet formulas even when preceded by whitespace/control characters.
  // eslint-disable-next-line no-control-regex -- Control prefixes must be checked for CSV safety.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function reportCsv(rows: Booking[]) {
  const values: (string | number)[][] = [['លេខកក់', 'ប្រធានបទ', 'កាលបរិច្ឆេទ', 'ចាប់ផ្តើម', 'បញ្ចប់', 'បន្ទប់', 'ផ្នែក', 'អ្នកសម្របសម្រួល', 'អ្នកចូលរួម', 'ស្ថានភាព', 'តំបន់ពេលវេលា'], ...rows.map((b) => [b.bookingId, b.title, b.date, b.startTime, b.endTime, b.room, b.department, b.coordinator, b.attendees, reportStatuses[b.status] || b.status, 'Asia/Phnom_Penh'])];
  return '\uFEFF' + values.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
