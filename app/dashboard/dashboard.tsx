'use client';

import { dashboardFetch as adminFetch } from '@/lib/dashboard-fetch';
import { Modal } from './modal';
import { ReportsPanel } from './reports-panel';
import { UsersPanel } from './users-panel';
import { CalendarSyncPanel } from './calendar-sync-panel';
import { RoomCalendarModal } from './room-calendar-modal';
import { TodayRoomAvailability } from './today-room-availability';
import { userCan, type DashboardUser } from '@/lib/server/user-policy';
import { GoogleLogin } from './google-login';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, CalendarDays, CircleAlert, Clock3, ExternalLink, LayoutDashboard, Pencil, Plus, RefreshCw, Search, Trash2, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { DEPARTMENTS, ROOMS } from '@/lib/meeting-config';
import type { Booking } from '@/lib/server/types';
import { useWebMcpTool } from '@/lib/use-webmcp';

type ApiList = { bookings?: Booking[]; configured?: boolean; message?: string };

const statusText: Record<string, string> = {
  PENDING: '⏳ កំពុងដំណើរការ', CALENDAR_CREATED: '📅 បានបង្កើត Calendar', CONFIRMED: '✅ បានបញ្ជាក់', ERROR: '⚠️ មានបញ្ហា', CANCELED: '❌ បានលុបចោល',
};

const READ_BOOKINGS_TOOL = {
  name: 'read_meeting_bookings', title: 'Read meeting bookings',
  description: 'Refresh the KSFH dashboard and return the current meeting room bookings.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
} as const;

const UPDATE_BOOKING_TOOL = {
  name: 'update_meeting_booking', title: 'Update meeting booking',
  description: 'Update an existing KSFH booking and synchronize Google Sheets, Calendar, and Telegram.',
  inputSchema: {
    type: 'object', additionalProperties: false,
    properties: {
      bookingId: { type: 'string' }, title: { type: 'string' }, coordinator: { type: 'string' }, phone: { type: 'string' },
      department: { type: 'string', enum: [...DEPARTMENTS] }, room: { type: 'string', enum: [...ROOMS] },
      date: { type: 'string', format: 'date' }, startTime: { type: 'string' }, endTime: { type: 'string' },
      attendees: { type: 'number', minimum: 0 }, notes: { type: 'string' },
    },
    required: ['bookingId', 'title', 'coordinator', 'department', 'room', 'date', 'startTime', 'endTime'],
  },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
} as const;

const CANCEL_BOOKING_TOOL = {
  name: 'cancel_meeting_booking', title: 'Cancel meeting booking',
  description: 'Cancel one KSFH booking, remove its Calendar event, update Telegram, and retain the audit row in Sheets.',
  inputSchema: { type: 'object', additionalProperties: false, properties: { bookingId: { type: 'string' } }, required: ['bookingId'] },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
} as const;

function todayString() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function Status({ value }: { value: string }) {
  const variant = value === 'ERROR' ? 'destructive' : value === 'CONFIRMED' ? 'default' : 'secondary';
  return <Badge variant={variant} className={value === 'CONFIRMED' ? 'bg-emerald-700' : ''}>{statusText[value] || value}</Badge>;
}

function telegramStatusText(booking: Booking) {
  if (booking.telegramStatus === 'SYNCED') return { text: '✅ បាន Sync សារចាស់', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
  if (booking.telegramStatus === 'NEW_MESSAGE') return { text: '🟡 បានផ្ញើសារថ្មីជំនួសសារចាស់', className: 'border-amber-200 bg-amber-50 text-amber-800' };
  if (booking.telegramStatus === 'FAILED') return { text: '🔴 មិនទាន់ Sync', className: 'border-red-200 bg-red-50 text-red-800' };
  if (booking.telegramStatus === 'DISABLED') return { text: '⚪ មិនបានកំណត់ Telegram', className: 'border-slate-200 bg-slate-50 text-slate-700' };
  return { text: '⚪ ទិន្នន័យចាស់ · នឹង Sync ពេលកែ', className: 'border-slate-200 bg-slate-50 text-slate-700' };
}

function savedNotice(action: 'updated' | 'canceled', booking: Booking) {
  const base = action === 'updated' ? '✅ បានរក្សាទុកការកែប្រែ។' : '✅ បានលុបចោលការកក់។';
  if (booking.telegramStatus === 'NEW_MESSAGE') return `${base} 🟡 Telegram បានផ្ញើសារថ្មីជំនួសសារចាស់។`;
  if (booking.telegramStatus === 'FAILED') return `${base} ⚠️ Telegram មិនទាន់ Sync — អាចសាកល្បងម្ដងទៀតក្នុងព័ត៌មានលម្អិត។`;
  return base;
}

function pageSequence(current: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages: Array<number | string> = [1];
  if (current > 3) pages.push('left-gap');
  for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) pages.push(page);
  if (current < total - 2) pages.push('right-gap');
  pages.push(total);
  return pages;
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  if (total <= 1) return null;
  return <nav aria-label="ទំព័របញ្ជីការកក់" className="flex items-center gap-2">
    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="ទំព័រមុន">← មុន</Button>
    <span className="min-w-28 text-center text-sm font-medium sm:hidden">ទំព័រ {page} នៃ {total}</span>
    <div className="hidden items-center gap-1 sm:flex">
      {pageSequence(page, total).map((item) => typeof item === 'number' ? <Button key={item} variant={item === page ? 'default' : 'outline'} size="sm" className="min-w-9 px-2" aria-current={item === page ? 'page' : undefined} aria-label={`ទំព័រ ${item}`} onClick={() => onChange(item)}>{item}</Button> : <span key={item} className="px-1 text-slate-400" aria-hidden="true">…</span>)}
    </div>
    <Button variant="outline" size="sm" disabled={page === total} onClick={() => onChange(page + 1)} aria-label="ទំព័របន្ទាប់">បន្ទាប់ →</Button>
  </nav>;
}

function EditPanel({ booking, onClose, onSaved }: { booking: Booking; onClose: () => void; onSaved: (booking: Booking) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError('');
    const data = new FormData(event.currentTarget);
    const payload = {
      ...booking, title: data.get('title'), coordinator: data.get('coordinator'), phone: data.get('phone'),
      department: data.get('department'), room: data.get('room'), date: data.get('date'),
      startTime: data.get('startTime'), endTime: data.get('endTime'), attendees: Number(data.get('attendees') || 0),
      notes: data.get('notes'), telegramInitData: '',
    };
    try {
      const response = await adminFetch(`/api/admin/bookings/${encodeURIComponent(booking.bookingId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json() as { booking?: Booking; message?: string };
      if (!response.ok || !result.booking) throw new Error(result.message || 'មិនអាចរក្សាទុកបាន');
      onSaved(result.booking);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'មានបញ្ហា'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="✏️ កែប្រែការកក់" onClose={onClose} busy={saving}>
      <p className="px-5 pt-4 text-xs text-slate-500">{booking.bookingId}</p>
        <form onSubmit={save} className="p-5"><fieldset disabled={saving} className="grid gap-4">
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <label htmlFor="edit-title" className="grid gap-1.5 text-sm font-semibold">ប្រធានបទ<Input id="edit-title" name="title" defaultValue={booking.title} required className="h-10" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="edit-coordinator" className="grid gap-1.5 text-sm font-semibold">អ្នកសម្របសម្រួល<Input id="edit-coordinator" name="coordinator" defaultValue={booking.coordinator} required className="h-10" /></label>
            <label htmlFor="edit-phone" className="grid gap-1.5 text-sm font-semibold">លេខទូរស័ព្ទ<Input id="edit-phone" name="phone" defaultValue={booking.phone} className="h-10" /></label>
          </div>
          <label htmlFor="edit-department" className="grid gap-1.5 text-sm font-semibold">ផ្នែក
            <NativeSelect id="edit-department" name="department" defaultValue={booking.department} className="w-full [&_select]:h-10">{DEPARTMENTS.map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}</NativeSelect>
          </label>
          <label htmlFor="edit-room" className="grid gap-1.5 text-sm font-semibold">បន្ទប់
            <NativeSelect id="edit-room" name="room" defaultValue={booking.room} className="w-full [&_select]:h-10">{ROOMS.map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}</NativeSelect>
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label htmlFor="edit-date" className="grid gap-1.5 text-sm font-semibold">កាលបរិច្ឆេទ<Input id="edit-date" name="date" type="date" defaultValue={booking.date} required className="h-10" /></label>
            <label htmlFor="edit-start" className="grid gap-1.5 text-sm font-semibold">ចាប់ផ្តើម<Input id="edit-start" name="startTime" type="time" defaultValue={booking.startTime} required className="h-10" /></label>
            <label htmlFor="edit-end" className="grid gap-1.5 text-sm font-semibold">បញ្ចប់<Input id="edit-end" name="endTime" type="time" defaultValue={booking.endTime} required className="h-10" /></label>
          </div>
          <label htmlFor="edit-attendees" className="grid gap-1.5 text-sm font-semibold">ចំនួនអ្នកចូលរួម<Input id="edit-attendees" name="attendees" type="number" min="0" defaultValue={booking.attendees} className="h-10" /></label>
          <label htmlFor="edit-notes" className="grid gap-1.5 text-sm font-semibold">កំណត់ចំណាំ<Textarea id="edit-notes" name="notes" defaultValue={booking.notes} rows={4} /></label>
          <div className="mt-2 flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={onClose} disabled={saving}>បោះបង់</Button><Button type="submit" disabled={saving}>{saving ? 'កំពុងរក្សាទុក…' : 'រក្សាទុកការកែប្រែ'}</Button></div>
        </fieldset></form>
    </Modal>
  );
}

function DashboardContent({ user, onSignOut, signingOut, guest = false }: { user: DashboardUser; onSignOut: () => void; signingOut: boolean; guest?: boolean }) {
  const { email } = user;
  const canEdit = userCan(user, 'bookings');
  const [view, setView] = useState<'bookings' | 'users' | 'reports' | 'calendar-sync' | 'inventory'>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [period, setPeriod] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const periodLabel = period === 'today' ? 'ថ្ងៃនេះ' : period === 'upcoming' ? 'នឹងមកដល់' : 'គ្រប់ថ្ងៃ';
  function selectSummary(scope: string) {
    setPeriod(scope); setStatus('ACTIVE'); setQuery(''); setPage(1);
    listHeading.current?.focus({ preventScroll: true });
    listHeading.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
  const [editing, setEditing] = useState<Booking | null>(null);
  const [canceling, setCanceling] = useState<Booking | null>(null);
  const [details, setDetails] = useState<Booking | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [telegramRetrying, setTelegramRetrying] = useState(false);
  const [telegramRetryError, setTelegramRetryError] = useState('');
  const [notice, setNotice] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  useEffect(() => {
    const navigate = () => {
      const hash = window.location.hash.slice(1);
      setView(hash === 'reports' || hash === 'inventory' || ((hash === 'users' || hash === 'calendar-sync') && user.role === 'owner') ? hash : 'bookings');
    };
    navigate(); window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, [user.role]);

  const load = useCallback(async (throwOnError = false) => {
    setLoading(true); setMessage('');
    try {
      const response = await (guest ? fetch('/api/guest/bookings', { cache: 'no-store' }) : adminFetch('/api/admin/bookings', { cache: 'no-store' }));
      const result = await response.json() as ApiList;
      if (!response.ok) throw new Error(result.message || 'មិនអាចអានទិន្នន័យបាន');
      const items = result.bookings || [];
      setBookings(items); setConfigured(result.configured !== false);
      return items;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'មានបញ្ហា');
      if (throwOnError) throw error;
      return [];
    }
    finally { setLoading(false); }
  }, [guest]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function cancelById(id: string) {
    if (!canEdit) throw new Error('សិទ្ធិមើលតែប៉ុណ្ណោះ');
    const response = await adminFetch(`/api/admin/bookings/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const result = await response.json() as { booking?: Booking; message?: string };
    if (!response.ok || !result.booking) throw new Error(result.message || 'មិនអាចលុបចោលបាន');
    setBookings((items) => items.map((item) => item.bookingId === result.booking?.bookingId ? result.booking : item));
    return result.booking;
  }

  useWebMcpTool(READ_BOOKINGS_TOOL, async () => {
    const items = await load(true);
    return { count: items.length, bookings: items };
  }, !guest);

  useWebMcpTool(UPDATE_BOOKING_TOOL, async (raw) => {
    if (!canEdit) throw new Error('សិទ្ធិមើលតែប៉ុណ្ណោះ');
    if (!raw || typeof raw !== 'object') throw new Error('Update input must be an object.');
    const data = raw as Record<string, unknown>;
    const id = typeof data.bookingId === 'string' ? data.bookingId : '';
    const current = bookings.find((item) => item.bookingId === id);
    if (!current) throw new Error('Booking not found in the current dashboard.');
    const response = await adminFetch(`/api/admin/bookings/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...current, ...data, requestId: current.requestId, technicalStaff: current.technicalStaff, equipment: current.equipment, telegramInitData: '' }),
    });
    const result = await response.json() as { booking?: Booking; message?: string };
    if (!response.ok || !result.booking) throw new Error(result.message || 'Unable to update booking.');
    setBookings((items) => items.map((item) => item.bookingId === id ? result.booking as Booking : item));
    return { bookingId: result.booking.bookingId, status: result.booking.status };
  }, canEdit);

  useWebMcpTool(CANCEL_BOOKING_TOOL, async (raw) => {
    const id = raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).bookingId === 'string' ? String((raw as Record<string, unknown>).bookingId) : '';
    if (!id) throw new Error('bookingId is required.');
    const booking = await cancelById(id);
    return { bookingId: booking.bookingId, status: booking.status };
  }, canEdit);
  const today = todayString();
  const active = bookings.filter((item) => item.status !== 'CANCELED');
  const visible = useMemo(() => bookings.filter((item) => {
    const matchesText = `${item.title} ${item.coordinator} ${item.room} ${item.department} ${item.bookingId}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === 'ALL' || (status === 'ACTIVE' ? item.status !== 'CANCELED' : item.status === status);
    const matchesPeriod = period === 'all' || (period === 'today' ? item.date === today : item.date > today);
    return matchesText && matchesStatus && matchesPeriod;
  }), [bookings, query, status, period, today]);
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = visible.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, visible.length);
  const pageBookings = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function goToPage(nextPage: number) {
    setPage(Math.max(1, Math.min(nextPage, totalPages)));
    window.requestAnimationFrame(() => {
      listHeading.current?.focus({ preventScroll: true });
      listHeading.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    });
  }
  function selectRoomToday(room: string) {
    setPeriod('today'); setStatus('ACTIVE'); setQuery(room); setPage(1);
    window.requestAnimationFrame(() => {
      listHeading.current?.focus({ preventScroll: true });
      listHeading.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    });
  }

  async function cancel() {
    if (!canceling || cancelBusy) return;
    setCancelBusy(true); setCancelError('');
    try {
      const saved = await cancelById(canceling.bookingId);
      setCanceling(null); setNotice(savedNotice('canceled', saved));
    } catch (error) { setCancelError(error instanceof Error ? error.message : 'មានបញ្ហា'); }
    finally { setCancelBusy(false); }
  }

  async function retryTelegram(booking: Booking) {
    if (telegramRetrying || !canEdit) return;
    setTelegramRetrying(true); setTelegramRetryError('');
    try {
      const response = await adminFetch(`/api/admin/bookings/${encodeURIComponent(booking.bookingId)}/telegram`, { method: 'POST' });
      const result = await response.json() as { booking?: Booking; message?: string };
      if (!response.ok || !result.booking) throw new Error(result.message || 'មិនអាច Sync Telegram បាន');
      setBookings((items) => items.map((item) => item.bookingId === result.booking?.bookingId ? result.booking : item));
      setDetails(result.booking); setNotice(result.booking.telegramStatus === 'NEW_MESSAGE' ? '🟡 Telegram បានផ្ញើសារថ្មីជំនួសសារចាស់។' : '✅ Telegram បាន Sync រួចរាល់។');
    } catch (error) { setTelegramRetryError(error instanceof Error ? error.message : 'មិនអាច Sync Telegram បាន'); }
    finally { setTelegramRetrying(false); }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-[#075d45] text-white print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-white/12"><LayoutDashboard /></div><div><p className="text-xs text-emerald-100">KSFH Meeting</p><h1 className="font-bold">ផ្ទាំងគ្រប់គ្រង</h1></div></div>
          <div className="flex flex-wrap items-center justify-end gap-2"><div className="text-right text-xs"><p className="font-semibold">{guest ? 'Guest' : user.name || email}</p>{!guest && <p className="max-w-56 truncate text-emerald-100" title={email}>{email}</p>}<p className="mt-1 text-emerald-100">{guest ? '🌐 សាធារណៈ · មើលតែប៉ុណ្ណោះ' : user.role === 'owner' ? '👑 ម្ចាស់ប្រព័ន្ធ' : user.role === 'editor' ? '✏️ គ្រប់គ្រង Booking' : '👁️ មើលតែប៉ុណ្ណោះ'}</p></div><Button variant="secondary" disabled={signingOut} onClick={onSignOut}>{signingOut ? 'កំពុងចាកចេញ…' : guest ? 'ចូលគណនី Google' : 'ចាកចេញ'}</Button><Link href="/request" target="_blank"><Button variant="secondary"><Plus /> Form ស្នើសុំ <ExternalLink className="size-3" /></Button></Link></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <nav className="sticky top-0 z-30 -mx-4 mb-5 flex gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50/95 px-4 py-3 shadow-sm backdrop-blur print:hidden sm:-mx-6 sm:px-6" aria-label="ផ្នែក Dashboard">
          {([{ key: 'bookings', label: '📅 ការកក់' }, { key: 'reports', label: '📊 របាយការណ៍' }, ...(user.role === 'owner' ? [{ key: 'calendar-sync', label: '🔄 Calendar Sync' }, { key: 'users', label: '👥 អ្នកប្រើ' }] : []), { key: 'inventory', label: '📦 Inventory' }] as { key: typeof view; label: string }[]).map((item) => <Button className="shrink-0" key={item.key} aria-current={view === item.key ? 'page' : undefined} variant={view === item.key ? 'default' : 'outline'} onClick={() => { window.location.hash = item.key; setView(item.key); setNotice(''); }}>{item.label}</Button>)}
          <Button className="shrink-0" variant="outline" aria-haspopup="dialog" aria-expanded={calendarOpen} onClick={() => setCalendarOpen(true)}>📅 ប្រតិទិនកក់បន្ទប់</Button>
        </nav>
        {notice && <output className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</output>}
        {view === 'inventory' ? <section aria-label="Inventory" className="min-h-[60vh] rounded-2xl border bg-white" /> : view === 'users' && user.role === 'owner' ? <UsersPanel /> : view === 'calendar-sync' && user.role === 'owner' ? <CalendarSyncPanel /> : <>
        {!canEdit && <p className="mb-4 rounded-xl bg-blue-50 p-3 text-sm leading-7 text-blue-800">{guest ? '🌐 Guest mode — អ្នកកំពុងមើល Dashboard សាធារណៈ។ អ្នកអាចមើលព័ត៌មានការកក់គ្រប់ផ្នែក និងរបាយការណ៍ ប៉ុន្តែមិនអាចកែ ឬលុបបាន។' : '👁️ សិទ្ធិមើលតែប៉ុណ្ណោះ — អ្នកអាចមើល និងស្វែងរកការកក់។'}</p>}
        {message && <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><CircleAlert className="size-4" />{message}</div>}
        {!configured && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Backend មិនទាន់បានភ្ជាប់</h2><p className="mt-1 text-sm text-amber-800">កូដរួចរាល់ ប៉ុន្តែត្រូវបញ្ចូល Google Service Account និង Secrets នៅ Cloudflare មុនទទួលទិន្នន័យពិត។</p><Link href="/setup" className="mt-3 inline-block text-sm font-bold text-amber-900 underline">មើលវិធីភ្ជាប់</Link></div>}

        {view === 'reports' ? <ReportsPanel bookings={bookings} loading={loading || !!message || !configured} onRefresh={() => void load()} onView={setDetails} /> : <>
        <section aria-label="សង្ខេបការកក់" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { scope: 'all', label: 'ការកក់សកម្ម', value: active.length, icon: CalendarCheck, color: 'text-emerald-700 bg-emerald-50' },
            { scope: 'today', label: 'ថ្ងៃនេះ', value: active.filter((item) => item.date === today).length, icon: CalendarDays, color: 'text-blue-700 bg-blue-50' },
            { scope: 'upcoming', label: 'នឹងមកដល់', value: active.filter((item) => item.date > today).length, icon: Clock3, color: 'text-violet-700 bg-violet-50' },
          ].map((card) => <button key={card.scope} type="button" aria-controls="booking-list" aria-pressed={period === card.scope && status === 'ACTIVE' && query === ''} onClick={() => selectSummary(card.scope)} disabled={loading || !configured || !!message} className="group rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-emerald-500 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 aria-pressed:border-emerald-600 aria-pressed:bg-emerald-50/40 disabled:cursor-wait disabled:opacity-60"><span className={`mb-4 grid size-10 place-items-center rounded-xl ${card.color}`}><card.icon className="size-5" /></span><span className="block text-sm text-slate-500">{card.label}</span><span className="mt-1 block text-3xl font-bold text-slate-900">{loading ? '…' : card.value}</span><span className="mt-3 block text-xs font-medium text-emerald-700 group-hover:underline">មើលការកក់ →</span></button>)}
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="mb-4 grid size-10 place-items-center rounded-xl bg-orange-50 text-orange-700"><UsersRound className="size-5" /></div><p className="text-sm text-slate-500">អ្នកចូលរួមសរុប</p><p className="mt-1 text-3xl font-bold text-slate-900">{loading ? '…' : active.reduce((sum, item) => sum + item.attendees, 0)}</p></div>
        </section>

        <section id="booking-list" aria-labelledby="booking-list-title" className="rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 ref={listHeading} id="booking-list-title" tabIndex={-1} className="scroll-mt-5 font-bold outline-none">បញ្ជីការកក់បន្ទប់ · {periodLabel}</h2><output className="text-xs text-slate-500">{visible.length} កំណត់ត្រា</output></div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input aria-label="ស្វែងរកការកក់" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="ស្វែងរក…" className="h-10 pl-9 sm:w-64" /></div>
              <NativeSelect aria-label="ថ្ងៃការកក់" value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1); }} className="w-full sm:w-36 [&_select]:h-10"><NativeSelectOption value="all">គ្រប់ថ្ងៃ</NativeSelectOption><NativeSelectOption value="today">ថ្ងៃនេះ</NativeSelectOption><NativeSelectOption value="upcoming">នឹងមកដល់</NativeSelectOption></NativeSelect>
              <NativeSelect aria-label="ស្ថានភាពការកក់" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="w-full sm:w-44 [&_select]:h-10"><NativeSelectOption value="ACTIVE">សកម្ម</NativeSelectOption><NativeSelectOption value="ALL">ទាំងអស់</NativeSelectOption><NativeSelectOption value="CONFIRMED">បានបញ្ជាក់</NativeSelectOption><NativeSelectOption value="ERROR">មានបញ្ហា</NativeSelectOption><NativeSelectOption value="CANCELED">បានលុបចោល</NativeSelectOption></NativeSelect>
              <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh"><RefreshCw className={loading ? 'animate-spin' : ''} /></Button>
              <TodayRoomAvailability bookings={bookings} loading={loading || !configured || !!message} onSelectRoom={selectRoomToday} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-3"><p className="text-xs text-slate-600">ម៉ោងកម្ពុជា · ចុចចំណងជើងការកក់ ដើម្បីមើលព័ត៌មានលម្អិត។</p><div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => { setPeriod('all'); setStatus('ACTIVE'); setQuery(''); setPage(1); }}>សម្អាតតម្រង</Button><a href="/request" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"><Plus className="size-4" />កក់បន្ទប់ថ្មី<ExternalLink className="size-3" /></a></div></div>
          {loading ? <div className="p-12 text-center text-sm text-slate-500">កំពុងទាញទិន្នន័យ…</div> : visible.length === 0 ? <div className="p-12 text-center"><CalendarDays className="mx-auto mb-3 size-9 text-slate-300" /><p className="font-medium">{bookings.length ? 'មិនមានលទ្ធផលតាមការស្វែងរក' : 'មិនទាន់មានការកក់'}</p><p className="mt-1 text-sm text-slate-500">{bookings.length ? 'សូមប្តូរពាក្យស្វែងរក ឬតម្រងស្ថានភាព។' : 'ការកក់ថ្មីនឹងបង្ហាញនៅទីនេះ'}</p></div> : (
            <div className="divide-y">
              {pageBookings.map((booking) => <article key={booking.bookingId} className="grid gap-3 p-4 transition hover:bg-slate-50 sm:grid-cols-[110px_minmax(0,1fr)_180px_130px_auto] sm:items-center">
                <div><p className="font-bold text-slate-900">{booking.date}</p><p className="text-sm text-emerald-700">{booking.startTime}–{booking.endTime}</p></div>
                <div className="min-w-0"><button onClick={() => setDetails(booking)} className="text-left font-semibold leading-7 text-emerald-800 underline-offset-4 hover:underline focus-visible:outline-2">{booking.title}<span className="mt-1 block text-xs font-normal text-slate-500">មើលព័ត៌មានលម្អិត →</span></button><p className="truncate text-sm text-slate-500">👤 {booking.coordinator} · 🏢 {booking.department}</p><p className="mt-1 text-xs text-slate-400">{booking.bookingId}</p></div>
                <div><p className="text-sm font-medium">📍 {booking.room}</p><p className="text-xs text-slate-500">👥 {booking.attendees || 0} នាក់</p></div>
                <Status value={booking.status} />
                {canEdit && <div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => setEditing(booking)} disabled={!canEdit || booking.status === 'CANCELED'} aria-label="កែប្រែ"><Pencil /></Button><Button variant="ghost" size="icon" className="text-red-600" onClick={() => { setCancelError(''); setCanceling(booking); }} disabled={!canEdit || booking.status === 'CANCELED'} aria-label="លុបចោល"><Trash2 /></Button></div>}
              </article>)}
            </div>
          )}
          <div className="flex flex-col gap-3 border-t bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <output aria-live="polite">បង្ហាញ {pageStart}–{pageEnd} នៃ {visible.length}</output>
              <label htmlFor="page-size" className="flex items-center gap-2">ក្នុងមួយទំព័រ
                <NativeSelect id="page-size" aria-label="ចំនួនកំណត់ត្រាក្នុងមួយទំព័រ" value={String(pageSize)} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="w-24 [&_select]:h-9"><NativeSelectOption value="25">25</NativeSelectOption><NativeSelectOption value="50">50</NativeSelectOption><NativeSelectOption value="100">100</NativeSelectOption></NativeSelect>
              </label>
            </div>
            <Pagination page={currentPage} total={totalPages} onChange={goToPage} />
          </div>
        </section>
        </>}
        </>}
      </div>

      {canEdit && editing && <EditPanel booking={editing} onClose={() => setEditing(null)} onSaved={(saved) => { setBookings((items) => items.map((item) => item.bookingId === saved.bookingId ? saved : item)); setEditing(null); setNotice(savedNotice('updated', saved)); }} />}
      {calendarOpen && <RoomCalendarModal onClose={() => setCalendarOpen(false)} />}
      {details && <Modal title="📅 ព័ត៌មានលម្អិតការកក់" onClose={() => { setDetails(null); setTelegramRetryError(''); }}><div className="space-y-5 p-5"><div><Status value={details.status} /><h3 className="mt-3 break-words text-xl font-bold leading-8">{details.title}</h3><p className="mt-1 text-xs text-slate-500">{details.bookingId}</p></div><dl className="grid gap-4 sm:grid-cols-2">{[
        ['📅 កាលបរិច្ឆេទ', details.date], ['🕒 ម៉ោងកម្ពុជា', details.startTime + '–' + details.endTime], ['📍 បន្ទប់', details.room], ['🏢 ផ្នែក', details.department], ['👤 អ្នកសម្របសម្រួល', details.coordinator], ['☎️ លេខទូរស័ព្ទ', details.phone], ['👥 អ្នកចូលរួម', String(details.attendees)], ['🛠️ បុគ្គលិកបច្ចេកទេស', details.technicalStaff.join(', ')], ['🎤 សម្ភារៈ', details.equipment.join(', ')], ['📝 កំណត់ចំណាំ', details.notes],
      ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{value || '—'}</dd></div>)}</dl>{!guest && (() => { const telegram = telegramStatusText(details); return <section aria-label="ស្ថានភាពការភ្ជាប់" className="rounded-xl border bg-slate-50 p-4"><h4 className="font-semibold">ស្ថានភាពការភ្ជាប់</h4><div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">📊 Google Sheet<br /><strong>បានរក្សាទុក</strong></p><p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">📅 Google Calendar<br /><strong>{details.googleEventId ? 'បាន Sync' : 'មិនទាន់ Sync'}</strong></p><p className={`rounded-lg border p-3 ${telegram.className}`}>📢 Telegram<br /><strong>{telegram.text}</strong></p></div>{details.telegramUpdatedAt && <p className="mt-2 text-xs text-slate-500">Telegram កែចុងក្រោយ៖ {new Date(details.telegramUpdatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' })}</p>}{canEdit && details.telegramStatus === 'FAILED' && <Button className="mt-3" variant="outline" disabled={telegramRetrying} onClick={() => void retryTelegram(details)}>{telegramRetrying ? 'កំពុងសាកល្បង…' : '🔄 សាកល្បង Telegram ម្ដងទៀត'}</Button>}{telegramRetryError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{telegramRetryError}</p>}</section>; })()}{details.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{details.error}</p>}<div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button variant="outline" onClick={() => { setDetails(null); setTelegramRetryError(''); }}>ត្រឡប់</Button>{canEdit && details.status !== 'CANCELED' && <Button onClick={() => { setEditing(details); setDetails(null); setTelegramRetryError(''); }}>✏️ កែប្រែការកក់</Button>}</div></div></Modal>}
      {canEdit && canceling && <Modal title="លុបចោលការកក់នេះ?" onClose={() => setCanceling(null)} busy={cancelBusy}><div className="space-y-4 p-5"><p className="font-semibold">{canceling.title}</p><p className="text-sm text-slate-500">{canceling.date} · {canceling.startTime}–{canceling.endTime} · {canceling.room}</p><p className="text-sm leading-6 text-slate-600">Calendar Event នឹងត្រូវលុប ហើយ Telegram នឹងបង្ហាញថាបានលុបចោល។ កំណត់ត្រានៅ Sheet នឹងរក្សាទុកសម្រាប់ប្រវត្តិ។</p>{cancelError && <p role="alert" className="text-sm text-red-700">{cancelError}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={cancelBusy} onClick={() => setCanceling(null)}>ត្រឡប់</Button><Button variant="destructive" disabled={cancelBusy} onClick={() => void cancel()}>{cancelBusy ? 'កំពុងលុបចោល…' : 'បញ្ជាក់លុបចោល'}</Button></div></div></Modal>}
    </main>
  );
}


export function Dashboard() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [guest, setGuest] = useState(false);
  const [checking, setChecking] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [sessionNotice, setSessionNotice] = useState('');
  const [error, setError] = useState('');
  const signedIn = useCallback(() => window.location.reload(), []);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        if (!response.ok) throw new Error('មិនអាចពិនិត្យ Login បាន។ សូម Refresh ទំព័រ');
        const result = await response.json() as { email: string | null; user?: DashboardUser; reason?: string; message?: string };
        if (active && result.reason === 'forbidden') setSessionNotice(result.message || 'គណនីនេះមិនមានសិទ្ធិចូល Dashboard។ សូមទាក់ទងម្ចាស់ប្រព័ន្ធ។');
        if (active) { setUser(result.user || null); setGuest(!result.user && window.sessionStorage.getItem('ksfh-guest') === '1'); setError(''); }
      } catch (reason) {
        if (active) { setUser(null); setError(reason instanceof Error ? reason.message : 'មិនអាចភ្ជាប់បាន'); }
      } finally { if (active) setChecking(false); }
    }
    const expire = () => { setUser(null); setSessionNotice('ការចូលប្រើបានផុតកំណត់។ សូមចូលដោយ Google ម្តងទៀត។'); };
    void check();
    const timer = window.setInterval(() => void check(), 60000);
    const permissionsChanged = () => { void check(); };
    window.addEventListener('ksfh-session-expired', expire);
    window.addEventListener('ksfh-permissions-changed', permissionsChanged);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('ksfh-session-expired', expire); window.removeEventListener('ksfh-permissions-changed', permissionsChanged); };
  }, []);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const response = await fetch('/api/auth/session', { method: 'DELETE' });
      if (!response.ok) throw new Error('មិនអាចចាកចេញបាន។ សូមព្យាយាមម្ដងទៀត');
      window.google?.accounts.id.disableAutoSelect();
      setUser(null); setGuest(false); window.sessionStorage.removeItem('ksfh-guest'); setSessionNotice('បានចាកចេញដោយជោគជ័យ។');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'មិនអាចចាកចេញបាន'); }
    finally { setSigningOut(false); }
  }

  function enterGuest() { window.sessionStorage.setItem('ksfh-guest', '1'); setSessionNotice(''); setGuest(true); window.location.hash = 'bookings'; }
  function leaveGuest() { window.sessionStorage.removeItem('ksfh-guest'); setGuest(false); setSessionNotice(''); }

  if (checking) return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-600">កំពុងពិនិត្យ Login…</main>;
  return <>
    {error && <div className="border-b bg-red-50 p-3 text-center text-sm text-red-700" role="alert">{error} <button className="underline" onClick={() => window.location.reload()}>Refresh</button></div>}
    {user ? <DashboardContent user={user} signingOut={signingOut} onSignOut={() => void signOut()} /> : guest ? <DashboardContent guest user={{ email: '', name: 'Guest', role: 'viewer', active: true, updatedAt: '', updatedBy: '' }} signingOut={false} onSignOut={leaveGuest} /> : <GoogleLogin onSignedIn={signedIn} onGuest={enterGuest} notice={sessionNotice} />}
  </>;
}
