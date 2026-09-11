'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, MapPin, Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { DEPARTMENTS, EQUIPMENT, ROOMS, TECHNICAL_STAFF, TIME_ZONE } from '@/lib/meeting-config';
import { useWebMcpTool } from '@/lib/use-webmcp';

const CREATE_BOOKING_TOOL = {
  name: 'create_meeting_booking',
  title: 'Create meeting booking',
  description: 'Create and immediately confirm a KSFH room booking when the requested room and time are available.',
  inputSchema: {
    type: 'object', additionalProperties: false,
    properties: {
      title: { type: 'string' }, coordinator: { type: 'string' }, phone: { type: 'string' },
      department: { type: 'string', enum: [...DEPARTMENTS] }, room: { type: 'string', enum: [...ROOMS] },
      date: { type: 'string', format: 'date' }, startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
      endTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' }, attendees: { type: 'number', minimum: 0 },
      technicalStaff: { type: 'array', items: { type: 'string', enum: [...TECHNICAL_STAFF] } },
      equipment: { type: 'array', items: { type: 'string', enum: [...EQUIPMENT] } }, notes: { type: 'string' },
    },
    required: ['title', 'coordinator', 'department', 'room', 'date', 'startTime', 'endTime'],
  },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
} as const;

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready: () => void;
        expand: () => void;
        close: () => void;
      };
    };
  }
}

type Notice = { kind: 'success' | 'error'; text: string } | null;

function MultiChoice({ name, options }: { name: string; options: readonly string[] }) {
  const [selected, setSelected] = useState<string[]>([]);

  function change(option: string, checked: boolean) {
    let next: string[];
    if (option === 'មិនមាន' && checked) next = ['មិនមាន'];
    else if (checked) next = [...selected.filter((item) => item !== 'មិនមាន'), option];
    else next = selected.filter((item) => item !== option);
    setSelected(next);
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <label key={option} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-sm transition hover:border-primary/50 hover:bg-emerald-50/50">
          <Checkbox
            checked={selected.includes(option)}
            onCheckedChange={(checked) => change(option, checked === true)}
          />
          <input type="checkbox" name={name} value={option} checked={selected.includes(option)} readOnly className="sr-only" />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-800">
      <span>{label}{required && <span className="ml-1 text-red-600">*</span>}</span>
      {children}
    </label>
  );
}

export function RequestForm() {
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [requestId, setRequestId] = useState('');

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
  }, []);

  async function sendPayload(payload: Record<string, unknown>) {
    const response = await fetch('/api/bookings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const result = await response.json() as { message?: string; bookingId?: string; status?: string };
    if (!response.ok) throw new Error(result.message || 'មិនអាចផ្ញើសំណើបាន');
    return result;
  }

  useWebMcpTool(CREATE_BOOKING_TOOL, async (raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('Booking input must be an object.');
    setSubmitting(true); setNotice(null);
    try {
      const payload = {
        ...(raw as Record<string, unknown>), requestId: crypto.randomUUID(), timeZone: TIME_ZONE,
        telegramInitData: window.Telegram?.WebApp?.initData || '', source: 'webmcp',
      };
      const result = await sendPayload(payload);
      setNotice({ kind: 'success', text: `បានកក់បន្ទប់ជោគជ័យ · លេខសម្គាល់ ${result.bookingId}` });
      return { bookingId: result.bookingId, status: result.status };
    } catch (error) {
      const text = error instanceof Error ? error.message : 'មិនអាចផ្ញើសំណើបាន';
      setNotice({ kind: 'error', text });
      throw error;
    } finally { setSubmitting(false); }
  });

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting(true);
    setNotice(null);

    const stableRequestId = requestId || crypto.randomUUID();
    if (!requestId) setRequestId(stableRequestId);
    const data = new FormData(form);
    const payload = {
      requestId: stableRequestId,
      title: data.get('title'),
      coordinator: data.get('coordinator'),
      phone: data.get('phone'),
      department: data.get('department'),
      room: data.get('room'),
      date: data.get('date'),
      startTime: data.get('startTime'),
      endTime: data.get('endTime'),
      attendees: Number(data.get('attendees') || 0),
      technicalStaff: data.getAll('technicalStaff'),
      equipment: data.getAll('equipment'),
      notes: data.get('notes'),
      timeZone: TIME_ZONE,
      telegramInitData: window.Telegram?.WebApp?.initData || '',
      source: window.Telegram?.WebApp?.initData ? 'telegram-mini-app' : 'public-web',
    };

    try {
      const result = await sendPayload(payload);
      setNotice({ kind: 'success', text: `បានកក់បន្ទប់ជោគជ័យ · លេខសម្គាល់ ${result.bookingId}` });
      form.reset();
      setRequestId('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'មានបញ្ហាក្នុងការផ្ញើសំណើ' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.16),transparent_32%),linear-gradient(180deg,#f7fcf9_0%,#eef7f2_100%)]">
      <header className="border-b border-emerald-900/10 bg-[#075d45] text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/20">
            <CalendarDays className="size-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-emerald-100">មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</p>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">ស្នើសុំបន្ទប់ប្រជុំ</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <section className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border bg-white/85 p-4"><MapPin className="size-5 text-emerald-700" /><span className="text-sm">ជ្រើសរើសបន្ទប់</span></div>
          <div className="flex items-center gap-3 rounded-2xl border bg-white/85 p-4"><Clock3 className="size-5 text-emerald-700" /><span className="text-sm">ពិនិត្យម៉ោងទំនេរ</span></div>
          <div className="flex items-center gap-3 rounded-2xl border bg-white/85 p-4"><CheckCircle2 className="size-5 text-emerald-700" /><span className="text-sm">បញ្ជាក់ភ្លាមៗ</span></div>
        </section>

        {notice && (
          <output className={`mb-5 block rounded-2xl border p-4 text-sm font-medium ${notice.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-800'}`}>
            {notice.text}
          </output>
        )}

        <form onSubmit={submit} className="surface-shadow overflow-hidden rounded-3xl border bg-white">
          <div className="border-b bg-emerald-50/70 px-5 py-5 sm:px-8">
            <h2 className="font-bold text-slate-900">ព័ត៌មានកម្មវិធី</h2>
            <p className="mt-1 text-sm text-slate-600">វាលដែលមានសញ្ញា * ត្រូវបំពេញជាចាំបាច់</p>
          </div>

          <div className="grid gap-6 p-5 sm:p-8">
            <Field label="ប្រធានបទ" required><Input name="title" required placeholder="ឧ. កិច្ចប្រជុំប្រចាំខែ" className="h-11" /></Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="អ្នកសម្របសម្រួល" required><Input name="coordinator" required placeholder="ឈ្មោះអ្នកទទួលខុសត្រូវ" className="h-11" /></Field>
              <Field label="លេខទូរស័ព្ទ"><Input name="phone" type="tel" inputMode="tel" placeholder="012 345 678" className="h-11" /></Field>
            </div>
            <Field label="ផ្នែកស្នើសុំ" required>
              <NativeSelect name="department" required defaultValue="" className="w-full [&_select]:h-11">
                <NativeSelectOption value="" disabled>ជ្រើសរើសផ្នែក</NativeSelectOption>
                {DEPARTMENTS.map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
            <Field label="ទីតាំងប្រជុំ" required>
              <NativeSelect name="room" required defaultValue="" className="w-full [&_select]:h-11">
                <NativeSelectOption value="" disabled>ជ្រើសរើសបន្ទប់</NativeSelectOption>
                {ROOMS.map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}
              </NativeSelect>
            </Field>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="កាលបរិច្ឆេទ" required><Input name="date" type="date" required className="h-11" /></Field>
              <Field label="ម៉ោងចាប់ផ្តើម" required><Input name="startTime" type="time" required className="h-11" /></Field>
              <Field label="ម៉ោងបញ្ចប់" required><Input name="endTime" type="time" required className="h-11" /></Field>
            </div>
            <Field label="ចំនួនអ្នកចូលរួម"><Input name="attendees" type="number" min="1" inputMode="numeric" placeholder="0" className="h-11" /></Field>

            <fieldset className="grid gap-3">
              <legend className="text-sm font-semibold text-slate-800">ស្នើសុំបុគ្គលិកបច្ចេកទេស</legend>
              <MultiChoice name="technicalStaff" options={TECHNICAL_STAFF} />
            </fieldset>
            <fieldset className="grid gap-3">
              <legend className="text-sm font-semibold text-slate-800">បញ្ជីស្នើសុំសម្ភារបច្ចេកទេស</legend>
              <MultiChoice name="equipment" options={EQUIPMENT} />
            </fieldset>
            <Field label="ផ្សេងៗ"><Textarea name="notes" rows={4} placeholder="កំណត់ចំណាំបន្ថែម" /></Field>
          </div>

          <div className="safe-bottom border-t bg-slate-50 px-5 pt-5 sm:px-8">
            <Button type="submit" disabled={submitting} size="lg" className="h-12 w-full rounded-xl bg-[#087a55] text-base hover:bg-[#066445]">
              {submitting ? 'កំពុងពិនិត្យ និងរក្សាទុក…' : <><Send className="size-5" /> ផ្ញើសំណើកក់បន្ទប់</>}
            </Button>
            <p className="mt-3 flex items-start justify-center gap-2 text-center text-xs leading-5 text-slate-500">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" /> ប្រព័ន្ធនឹងបញ្ជាក់ភ្លាម ប្រសិនបើបន្ទប់ និងម៉ោងនៅទំនេរ
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
