'use client';

import { GoogleLogin } from './google-login';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, CalendarDays, CircleAlert, Clock3, ExternalLink, LayoutDashboard, Pencil, Plus, RefreshCw, Search, Trash2, UsersRound, X } from 'lucide-react';
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
  PENDING: 'កំពុងដំណើរការ', CALENDAR_CREATED: 'បានបង្កើត Calendar', CONFIRMED: 'បានបញ្ជាក់', ERROR: 'មានបញ្ហា', CANCELED: 'បានលុបចោល',
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

function EditPanel({ booking, onClose, onSaved }: { booking: Booking; onClose: () => void; onSaved: (booking: Booking) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
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
    <dialog open className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none bg-slate-950/25 p-0 backdrop-blur-sm">
      <div className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/95 px-5 py-4 backdrop-blur">
          <div><h2 className="font-bold">កែប្រែការកក់</h2><p className="text-xs text-slate-500">{booking.bookingId}</p></div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="បិទ"><X /></Button>
        </div>
        <form onSubmit={save} className="grid gap-4 p-5">
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
          <div className="mt-2 flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={onClose}>បោះបង់</Button><Button type="submit" disabled={saving}>{saving ? 'កំពុងរក្សាទុក…' : 'រក្សាទុកការកែប្រែ'}</Button></div>
        </form>
      </div>
    </dialog>
  );
}

function DashboardContent({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [editing, setEditing] = useState<Booking | null>(null);
  const [canceling, setCanceling] = useState<Booking | null>(null);

  const load = useCallback(async (throwOnError = false) => {
    setLoading(true); setMessage('');
    try {
      const response = await adminFetch('/api/admin/bookings', { cache: 'no-store' });
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
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function cancelById(id: string) {
    const response = await adminFetch(`/api/admin/bookings/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const result = await response.json() as { booking?: Booking; message?: string };
    if (!response.ok || !result.booking) throw new Error(result.message || 'មិនអាចលុបចោលបាន');
    setBookings((items) => items.map((item) => item.bookingId === result.booking?.bookingId ? result.booking : item));
    return result.booking;
  }

  useWebMcpTool(READ_BOOKINGS_TOOL, async () => {
    const items = await load(true);
    return { count: items.length, bookings: items };
  });

  useWebMcpTool(UPDATE_BOOKING_TOOL, async (raw) => {
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
  });

  useWebMcpTool(CANCEL_BOOKING_TOOL, async (raw) => {
    const id = raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).bookingId === 'string' ? String((raw as Record<string, unknown>).bookingId) : '';
    if (!id) throw new Error('bookingId is required.');
    const booking = await cancelById(id);
    return { bookingId: booking.bookingId, status: booking.status };
  });
  const today = todayString();
  const active = bookings.filter((item) => item.status !== 'CANCELED');
  const visible = useMemo(() => bookings.filter((item) => {
    const matchesText = `${item.title} ${item.coordinator} ${item.room} ${item.department} ${item.bookingId}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === 'ALL' || (status === 'ACTIVE' ? item.status !== 'CANCELED' : item.status === status);
    return matchesText && matchesStatus;
  }), [bookings, query, status]);

  async function cancel() {
    if (!canceling) return;
    setMessage('');
    try {
      await cancelById(canceling.bookingId);
      setCanceling(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'មានបញ្ហា'); }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-[#075d45] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-white/12"><LayoutDashboard /></div><div><p className="text-xs text-emerald-100">KSFH Meeting</p><h1 className="font-bold">ផ្ទាំងគ្រប់គ្រង</h1></div></div>
          <div className="flex flex-wrap items-center justify-end gap-2"><span className="text-xs text-emerald-100">{email}</span><Button variant="secondary" onClick={onSignOut}>ចាកចេញ</Button><Link href="/request" target="_blank"><Button variant="secondary"><Plus /> Form ស្នើសុំ <ExternalLink className="size-3" /></Button></Link></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {message && <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><CircleAlert className="size-4" />{message}</div>}
        {!configured && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Backend មិនទាន់បានភ្ជាប់</h2><p className="mt-1 text-sm text-amber-800">កូដរួចរាល់ ប៉ុន្តែត្រូវបញ្ចូល Google Service Account និង Secrets នៅ Cloudflare មុនទទួលទិន្នន័យពិត។</p><Link href="/setup" className="mt-3 inline-block text-sm font-bold text-amber-900 underline">មើលវិធីភ្ជាប់</Link></div>}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'ការកក់សកម្ម', value: active.length, icon: CalendarCheck, color: 'text-emerald-700 bg-emerald-50' },
            { label: 'ថ្ងៃនេះ', value: active.filter((item) => item.date === today).length, icon: CalendarDays, color: 'text-blue-700 bg-blue-50' },
            { label: 'នឹងមកដល់', value: active.filter((item) => item.date > today).length, icon: Clock3, color: 'text-violet-700 bg-violet-50' },
            { label: 'អ្នកចូលរួមសរុប', value: active.reduce((sum, item) => sum + item.attendees, 0), icon: UsersRound, color: 'text-orange-700 bg-orange-50' },
          ].map((card) => <div key={card.label} className="rounded-2xl border bg-white p-5 shadow-sm"><div className={`mb-4 grid size-10 place-items-center rounded-xl ${card.color}`}><card.icon className="size-5" /></div><p className="text-sm text-slate-500">{card.label}</p><p className="mt-1 text-3xl font-bold text-slate-900">{card.value}</p></div>)}
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-bold">បញ្ជីការកក់បន្ទប់</h2><p className="text-xs text-slate-500">{visible.length} កំណត់ត្រា</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ស្វែងរក…" className="h-10 pl-9 sm:w-64" /></div>
              <NativeSelect value={status} onChange={(event) => setStatus(event.target.value)} className="w-full sm:w-44 [&_select]:h-10"><NativeSelectOption value="ACTIVE">សកម្ម</NativeSelectOption><NativeSelectOption value="ALL">ទាំងអស់</NativeSelectOption><NativeSelectOption value="CONFIRMED">បានបញ្ជាក់</NativeSelectOption><NativeSelectOption value="ERROR">មានបញ្ហា</NativeSelectOption><NativeSelectOption value="CANCELED">បានលុបចោល</NativeSelectOption></NativeSelect>
              <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh"><RefreshCw className={loading ? 'animate-spin' : ''} /></Button>
            </div>
          </div>
          {loading ? <div className="p-12 text-center text-sm text-slate-500">កំពុងទាញទិន្នន័យ…</div> : visible.length === 0 ? <div className="p-12 text-center"><CalendarDays className="mx-auto mb-3 size-9 text-slate-300" /><p className="font-medium">មិនទាន់មានការកក់</p><p className="mt-1 text-sm text-slate-500">ការកក់ថ្មីនឹងបង្ហាញនៅទីនេះ</p></div> : (
            <div className="divide-y">
              {visible.map((booking) => <article key={booking.bookingId} className="grid gap-3 p-4 transition hover:bg-slate-50 sm:grid-cols-[110px_minmax(0,1fr)_180px_130px_auto] sm:items-center">
                <div><p className="font-bold text-slate-900">{booking.date}</p><p className="text-sm text-emerald-700">{booking.startTime}–{booking.endTime}</p></div>
                <div className="min-w-0"><p className="truncate font-semibold">{booking.title}</p><p className="truncate text-sm text-slate-500">{booking.coordinator} · {booking.department}</p><p className="mt-1 text-xs text-slate-400">{booking.bookingId}</p></div>
                <div><p className="text-sm font-medium">{booking.room}</p><p className="text-xs text-slate-500">{booking.attendees || 0} នាក់</p></div>
                <Status value={booking.status} />
                <div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => setEditing(booking)} disabled={booking.status === 'CANCELED'} aria-label="កែប្រែ"><Pencil /></Button><Button variant="ghost" size="icon" className="text-red-600" onClick={() => setCanceling(booking)} disabled={booking.status === 'CANCELED'} aria-label="លុបចោល"><Trash2 /></Button></div>
              </article>)}
            </div>
          )}
        </section>
      </div>

      {editing && <EditPanel booking={editing} onClose={() => setEditing(null)} onSaved={(saved) => { setBookings((items) => items.map((item) => item.bookingId === saved.bookingId ? saved : item)); setEditing(null); }} />}
      {canceling && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 grid size-11 place-items-center rounded-xl bg-red-50 text-red-600"><Trash2 /></div><h2 className="font-bold">លុបចោលការកក់នេះ?</h2><p className="mt-2 text-sm text-slate-600">Calendar Event នឹងត្រូវលុប ហើយ Telegram នឹងបង្ហាញថាបានលុបចោល។ កំណត់ត្រានៅ Sheet នឹងរក្សាទុកសម្រាប់ប្រវត្តិ។</p><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setCanceling(null)}>ត្រឡប់</Button><Button variant="destructive" onClick={() => void cancel()}>លុបចោល</Button></div></div></div>}
    </main>
  );
}


async function adminFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.status === 401 || response.status === 403) window.dispatchEvent(new Event('ksfh-session-expired'));
  return response;
}

export function Dashboard() {
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const signedIn = useCallback((value: string) => { setEmail(value); setError(''); }, []);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        if (!response.ok) throw new Error('មិនអាចពិនិត្យ Login បាន។ សូម Refresh ទំព័រ');
        const result = await response.json() as { email: string | null };
        if (active) { setEmail(result.email); setError(''); }
      } catch (reason) {
        if (active) { setEmail(null); setError(reason instanceof Error ? reason.message : 'មិនអាចភ្ជាប់បាន'); }
      } finally { if (active) setChecking(false); }
    }
    const expire = () => setEmail(null);
    void check();
    const timer = window.setInterval(() => void check(), 60000);
    window.addEventListener('ksfh-session-expired', expire);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('ksfh-session-expired', expire); };
  }, []);

  async function signOut() {
    try {
      const response = await fetch('/api/auth/session', { method: 'DELETE' });
      if (!response.ok) throw new Error('មិនអាចចាកចេញបាន។ សូមព្យាយាមម្ដងទៀត');
      window.google?.accounts.id.disableAutoSelect();
      setEmail(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'មិនអាចចាកចេញបាន'); }
  }

  if (checking) return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-600">កំពុងពិនិត្យ Login…</main>;
  return <>
    {error && <div className="border-b bg-red-50 p-3 text-center text-sm text-red-700" role="alert">{error} <button className="underline" onClick={() => window.location.reload()}>Refresh</button></div>}
    {email ? <DashboardContent email={email} onSignOut={() => void signOut()} /> : <GoogleLogin onSignedIn={signedIn} />}
  </>;
}
