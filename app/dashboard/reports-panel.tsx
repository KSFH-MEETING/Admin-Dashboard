'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { filterReport, summarizeReport, reportCsv, reportStatuses } from '@/lib/booking-reports';
import type { Booking } from '@/lib/server/types';

export function ReportsPanel({ bookings, loading, onRefresh, onView }: { bookings: Booking[]; loading: boolean; onRefresh: () => void; onView: (booking: Booking) => void }) {
  const [filter, setFilter] = useState({ from: '', to: '', room: '', status: '' });
  const [page, setPage] = useState(1);
  const rows = useMemo(() => filterReport(bookings, filter), [bookings, filter]);
  const summary = summarizeReport(rows);
  const invalid = !!(filter.from && filter.to && filter.from > filter.to);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageStart = rows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(currentPage * pageSize, rows.length);

  function updateFilter(next: Partial<typeof filter>) {
    setFilter((current) => ({ ...current, ...next }));
    setPage(1);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([reportCsv(rows)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `KSFH-bookings-${filter.from || 'all'}-${filter.to || 'all'}.csv`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="space-y-5" aria-labelledby="reports-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="reports-title" className="text-xl font-bold">📊 របាយការណ៍ការកក់</h2><p className="mt-2 text-sm text-slate-600">គិតតាមថ្ងៃប្រជុំ · ម៉ោងកម្ពុជា (Asia/Phnom_Penh)</p></div><div className="grid w-full grid-cols-2 gap-2 print:hidden sm:flex sm:w-auto"><Button className="h-10" variant="outline" onClick={onRefresh} disabled={loading}>Refresh</Button><Button className="h-10" variant="outline" onClick={download} disabled={loading || invalid || !rows.length}>ទាញយក CSV</Button><Button className="col-span-2 h-10 sm:col-span-1" onClick={() => window.print()} disabled={loading || invalid || !rows.length}>បោះពុម្ព / PDF</Button></div></div>
    <div className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
      <label htmlFor="report-from" className="grid gap-2 text-sm">ពីថ្ងៃ<Input id="report-from" type="date" value={filter.from} onChange={(e) => updateFilter({ from: e.target.value })} /></label>
      <label htmlFor="report-to" className="grid gap-2 text-sm">ដល់ថ្ងៃ<Input id="report-to" type="date" min={filter.from || undefined} value={filter.to} onChange={(e) => updateFilter({ to: e.target.value })} /></label>
      <label className="grid gap-2 text-sm">បន្ទប់<NativeSelect value={filter.room} onChange={(e) => updateFilter({ room: e.target.value })}><NativeSelectOption value="">ទាំងអស់</NativeSelectOption>{[...new Set(bookings.map((b) => b.room))].sort().map((room) => <NativeSelectOption key={room} value={room}>{room}</NativeSelectOption>)}</NativeSelect></label>
      <label className="grid gap-2 text-sm">ស្ថានភាព<NativeSelect value={filter.status} onChange={(e) => updateFilter({ status: e.target.value })}><NativeSelectOption value="">ទាំងអស់</NativeSelectOption>{Object.entries(reportStatuses).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect></label>
      <Button className="h-10" variant="ghost" onClick={() => { setFilter({ from: '', to: '', room: '', status: '' }); setPage(1); }}>សម្អាតតម្រង</Button>
    </div>
    <p className="text-sm text-slate-600">{filter.from || 'គ្រប់ថ្ងៃ'} → {filter.to || 'គ្រប់ថ្ងៃ'} · {filter.room || 'គ្រប់បន្ទប់'} · {reportStatuses[filter.status] || 'គ្រប់ស្ថានភាព'}</p>
    {invalid ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">ថ្ងៃបញ្ចប់ត្រូវនៅក្រោយ ឬស្មើថ្ងៃចាប់ផ្តើម។</p> : loading ? <output className="p-8 text-center">កំពុងទាញទិន្នន័យ…</output> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['ការកក់សរុប', summary.total], ['បានបញ្ជាក់', summary.confirmed], ['បានលុបចោល', summary.canceled], ['អ្នកចូលរួម (បានបញ្ជាក់)', summary.attendees]].map(([label, count]) => <div key={label} className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-600">{label}</p><p className="mt-3 text-2xl font-bold">{count}</p></div>)}</div>
      <p className="text-xs text-slate-500">ចំនួនអ្នកចូលរួមគឺផលបូកតាមការកក់ដែលបានបញ្ជាក់ មិនមែនចំនួនមនុស្សមិនស្ទួន ឬវត្តមានជាក់ស្តែងទេ។</p>
      {!rows.length ? <p className="rounded-xl border bg-white p-10 text-center text-slate-500">មិនមានការកក់តាមតម្រងនេះទេ។</p> : <>
        <div className="grid gap-3 md:hidden">{pageRows.map((b) => <article key={b.bookingId} className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{b.date}</p><p className="text-xs text-slate-500">{b.startTime}–{b.endTime}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">{reportStatuses[b.status] || b.status}</span></div><button onClick={() => onView(b)} className="mt-3 text-left font-semibold leading-7 text-emerald-800 underline-offset-4 hover:underline focus-visible:outline-2">{b.title}</button><p className="mt-2 text-sm text-slate-600">🏢 {b.department}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm"><span>📍 {b.room}</span><span>👥 {b.attendees}</span></div><p className="mt-3 text-xs text-slate-400">{b.bookingId}</p></article>)}</div>
        <div className="hidden overflow-x-auto rounded-xl border bg-white print:hidden md:block"><table className="w-full text-left text-sm"><caption className="sr-only">របាយការណ៍ការកក់តាមតម្រង</caption><thead className="bg-slate-100"><tr>{['ថ្ងៃ / ម៉ោង', 'ប្រធានបទ / ផ្នែក', 'បន្ទប់', 'អ្នកចូលរួម', 'ស្ថានភាព'].map((label) => <th scope="col" key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{pageRows.map((b) => <tr key={b.bookingId} className="border-t align-top"><td className="whitespace-nowrap p-3">{b.date}<div className="text-xs text-slate-500">{b.startTime}–{b.endTime}</div></td><td className="min-w-52 p-3"><button onClick={() => onView(b)} className="text-left font-semibold text-emerald-800 underline-offset-4 hover:underline focus-visible:outline-2">{b.title}</button><div className="mt-1 text-xs text-slate-500">{b.department}</div><div className="text-xs text-slate-500">{b.bookingId}</div></td><td className="p-3">{b.room}</td><td className="p-3">{b.attendees}</td><td className="p-3">{reportStatuses[b.status] || b.status}</td></tr>)}</tbody></table></div>
        <div className="hidden print:block"><table className="w-full text-left text-sm"><caption className="sr-only">របាយការណ៍ការកក់ទាំងអស់តាមតម្រង</caption><thead><tr>{['ថ្ងៃ / ម៉ោង', 'ប្រធានបទ / ផ្នែក', 'បន្ទប់', 'អ្នកចូលរួម', 'ស្ថានភាព'].map((label) => <th scope="col" key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{rows.map((b) => <tr key={b.bookingId} className="border-t align-top"><td className="whitespace-nowrap p-2">{b.date}<div>{b.startTime}–{b.endTime}</div></td><td className="p-2"><strong>{b.title}</strong><div>{b.department}</div></td><td className="p-2">{b.room}</td><td className="p-2">{b.attendees}</td><td className="p-2">{reportStatuses[b.status] || b.status}</td></tr>)}</tbody></table></div>
        <nav aria-label="ទំព័ររបាយការណ៍" className="flex flex-col items-center justify-between gap-3 rounded-xl border bg-white p-3 print:hidden sm:flex-row"><p className="text-sm text-slate-600">បង្ហាញ {pageStart}–{pageEnd} នៃ {rows.length}</p><div className="flex w-full items-center gap-2 sm:w-auto"><Button className="h-10 flex-1 sm:flex-none" variant="outline" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← មុន</Button><span className="min-w-20 text-center text-sm">{currentPage} / {totalPages}</span><Button className="h-10 flex-1 sm:flex-none" variant="outline" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>បន្ទាប់ →</Button></div></nav>
      </>}
    </>}
  </section>;
}
