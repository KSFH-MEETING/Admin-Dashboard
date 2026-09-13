'use client';

import { dashboardFetch } from '@/lib/dashboard-fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarCheck, CircleAlert, Link2, RefreshCw } from 'lucide-react';
import { useState } from 'react';

type SyncSummary = {
  month: string;
  total: number;
  linked: number;
  needsSync: number;
  missingLink: number;
  missingEvent: number;
  dateMismatches: number;
  processed?: number;
  failed?: number;
  errors?: string[];
  message?: string;
};

function currentMonth() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit' }).format(new Date());
}

export function CalendarSyncPanel() {
  const [month, setMonth] = useState(currentMonth);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [checking, setChecking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function check(selectedMonth = month) {
    if (!selectedMonth) return null;
    setChecking(true); setError(''); setNotice('');
    try {
      const response = await dashboardFetch(`/api/admin/calendar-sync?month=${encodeURIComponent(selectedMonth)}`, { cache: 'no-store' });
      const result = await response.json() as SyncSummary;
      if (!response.ok) throw new Error(result.message || 'មិនអាចពិនិត្យបាន');
      setSummary(result);
      return result;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'មានបញ្ហា');
      return null;
    } finally { setChecking(false); }
  }

  async function sync() {
    if (!month || syncing) return;
    setSyncing(true); setError(''); setNotice('');
    let totalProcessed = 0;
    try {
      let latest = summary || await check(month);
      if (!latest) return;
      for (let batch = 0; latest.needsSync > 0 && batch < 100; batch += 1) {
        const response = await dashboardFetch('/api/admin/calendar-sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month }),
        });
        latest = await response.json() as SyncSummary;
        if (!response.ok) throw new Error(latest.message || 'មិនអាច Sync បាន');
        totalProcessed += latest.processed || 0;
        setSummary(latest);
        if (latest.failed) throw new Error(latest.errors?.[0] || `${latest.failed} records មានបញ្ហា`);
        if (!latest.processed && latest.needsSync > 0) throw new Error('Sync មិនអាចបន្តបាន');
      }
      await new Promise((resolve) => window.setTimeout(resolve, 750));
      const verified = await check(month);
      if (verified?.needsSync === 0) setNotice(`✅ Sync រួចរាល់ ${totalProcessed} records។ Google Sheet និង Calendar ត្រូវគ្នា។`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'មានបញ្ហា'); }
    finally { setSyncing(false); }
  }

  const busy = checking || syncing;
  return (
    <section aria-labelledby="calendar-sync-title" className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CalendarCheck /></span>
          <div><h2 id="calendar-sync-title" className="text-lg font-bold">Calendar Sync</h2><p className="mt-1 text-sm leading-6 text-slate-500">ពិនិត្យ និងភ្ជាប់ Booking ក្នុង Google Sheet ទៅ Google Calendar តាមខែ។</p></div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label htmlFor="sync-month" className="grid flex-1 gap-1.5 text-sm font-semibold">ជ្រើសរើសខែ<Input id="sync-month" type="month" value={month} onChange={(event) => { setMonth(event.target.value); setSummary(null); setNotice(''); setError(''); }} className="h-11" /></label>
          <Button variant="outline" disabled={busy || !month} onClick={() => void check()} className="h-11"><RefreshCw className={checking ? 'animate-spin' : ''} />ពិនិត្យ</Button>
          <Button disabled={busy || !summary || summary.needsSync === 0} onClick={() => void sync()} className="h-11">{syncing ? <><RefreshCw className="animate-spin" />កំពុង Sync…</> : <><Link2 />Sync ខែនេះ</>}</Button>
        </div>

        {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</div>}
        {notice && <output className="block rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</output>}

        {summary ? <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border p-4"><p className="text-xs text-slate-500">Booking សរុប</p><p className="mt-1 text-2xl font-bold">{summary.total}</p></div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"><p className="text-xs text-emerald-700">បានភ្ជាប់</p><p className="mt-1 text-2xl font-bold text-emerald-800">{summary.linked}</p></div>
            <div className={`rounded-xl border p-4 ${summary.needsSync ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/50'}`}><p className="text-xs text-slate-600">ត្រូវ Sync</p><p className="mt-1 text-2xl font-bold">{summary.needsSync}</p></div>
          </div>
          {summary.needsSync > 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">មិនទាន់មាន Link: {summary.missingLink} · Event បាត់: {summary.missingEvent} · ថ្ងៃ/ម៉ោងខុស: {summary.dateMismatches}</p>}
          {summary.total === 0 && <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">មិនមាន Booking ក្នុងខែនេះទេ។</p>}
        </> : <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">ជ្រើសរើសខែ ហើយចុច «ពិនិត្យ»។</p>}

        <p className="border-t pt-4 text-xs leading-6 text-slate-500">សម្រាប់ Owner ប៉ុណ្ណោះ។ បើកែ Booking តាម Dashboard វានឹង Sync ដោយស្វ័យប្រវត្តិ។ បើកែ Google Sheet ដោយផ្ទាល់ សូមមកពិនិត្យ និង Sync នៅទីនេះ។</p>
      </div>
    </section>
  );
}
