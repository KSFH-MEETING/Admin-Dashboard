/* eslint-disable nextjs/no-html-link-for-pages -- Use native navigation: Vinext client navigation fails for the public request route. */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { dashboardFetch } from '@/lib/dashboard-fetch';
import { parseUserInput, normalizeEmail, type DashboardRole, type DashboardUser } from '@/lib/server/user-policy';

const roleLabel = { owner: 'ម្ចាស់ប្រព័ន្ធ', editor: 'គ្រប់គ្រងការកក់', viewer: 'មើលតែប៉ុណ្ណោះ' };
const roleDescription = { owner: 'គ្រប់គ្រងការកក់ របាយការណ៍ សិទ្ធិអ្នកប្រើ និង Stock សម្ភារៈប្រជុំ។', editor: 'មើល កែ និងលុបចោលការកក់គ្រប់ផ្នែក។ មើលរបាយការណ៍ និង Stock។ មិនអាចកែ Stock ឬគ្រប់គ្រងអ្នកប្រើ។', viewer: 'មើលការកក់ របាយការណ៍ និង Stock សម្ភារៈប្រជុំ។ មិនអាចកែ Booking, Stock ឬគ្រប់គ្រងអ្នកប្រើ។' };

function PermissionTable() {
  return <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><caption className="p-4 text-left font-semibold">សិទ្ធិតាមតួនាទី · អនុវត្តចំពោះការកក់គ្រប់ផ្នែក</caption><thead className="bg-slate-50"><tr>{['មុខងារ', 'Owner', 'Editor', 'Viewer'].map((text) => <th scope="col" className="px-4 py-3" key={text}>{text}</th>)}</tr></thead><tbody>{[
    ['មើលព័ត៌មានការកក់', true, true, true], ['មើល / ទាញយករបាយការណ៍', true, true, true], ['មើល Stock សម្ភារៈ', true, true, true], ['កែ Stock សម្ភារៈ', true, false, false], ['កែការកក់', true, true, false], ['លុបចោលការកក់', true, true, false], ['បន្ថែម / កែ / បិទអ្នកប្រើ', true, false, false],
  ].map(([label, ...values]) => <tr key={String(label)} className="border-t"><th scope="row" className="px-4 py-3 font-normal">{label}</th>{values.map((allowed, index) => <td key={index} className={`px-4 py-3 ${allowed ? 'text-emerald-800' : 'text-slate-500'}`}>{allowed ? '✓ បាន' : '— មិនបាន'}</td>)}</tr>)}</tbody></table></div>;
}

function UserEditor({ user, users, onClose, onSave }: { user: DashboardUser | null; users: DashboardUser[]; onClose: () => void; onSave: (input: ReturnType<typeof parseUserInput>, create: boolean) => Promise<void> }) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState<'editor' | 'viewer'>(user?.role === 'editor' ? 'editor' : 'viewer');
  const [active, setActive] = useState(user?.active ?? true);
  const [review, setReview] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (review || discard) stepHeading.current?.focus(); }, [review, discard]);
  const [error, setError] = useState('');
  const duplicate = !user && users.some((item) => item.email === normalizeEmail(email));
  const changed = user ? name.trim() !== user.name || role !== user.role || active !== user.active : !!(name || email || role !== 'viewer' || !active);
  const requestClose = () => { if (!busy) { if (changed) setDiscard(true); else onClose(); } };

  async function save() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await onSave(parseUserInput({ name, email, role, active }), !user); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'មិនអាចរក្សាទុកបាន។ សូមព្យាយាមម្ដងទៀត។'); }
    finally { lock.current = false; setBusy(false); }
  }
  function prepare(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    try { parseUserInput({ name, email, role, active }); if (duplicate) throw new Error('Email នេះមានរួចហើយ។ សូមកែអ្នកប្រើដែលមានស្រាប់។'); setReview(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'សូមពិនិត្យព័ត៌មាន'); }
  }

  return <Modal title={user ? '✏️ កែអ្នកប្រើ និងសិទ្ធិ' : '➕ បន្ថែមអ្នកប្រើ'} onClose={requestClose} busy={busy}><div className="space-y-4 p-5">
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {discard ? <><h3 ref={stepHeading} tabIndex={-1} className="font-semibold outline-none">បោះបង់ការកែដែលមិនទាន់រក្សាទុក?</h3><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setDiscard(false)}>បន្តកែ</Button><Button variant="destructive" onClick={onClose}>បោះបង់ការកែ</Button></div></> : review ? <>
      <h3 ref={stepHeading} tabIndex={-1} className="font-semibold outline-none">ពិនិត្យមុនរក្សាទុក</h3><dl className="grid gap-3 text-sm"><div><dt className="text-slate-500">ឈ្មោះ / Google Email</dt><dd className="mt-1 break-all">{name.trim()} · {normalizeEmail(email)}</dd></div><div><dt className="text-slate-500">សិទ្ធិ</dt><dd className="mt-1 font-semibold">{user && user.role !== role ? `${roleLabel[user.role]} → ` : ''}{roleLabel[role]}</dd></div><div><dt className="text-slate-500">ស្ថានភាព</dt><dd className="mt-1">{active ? '🟢 អនុញ្ញាតឱ្យចូល Dashboard' : '⛔ បិទការចូល Dashboard'}</dd></div></dl>
      <p className="rounded-xl bg-blue-50 p-4 text-sm leading-7 text-blue-900">{active ? roleDescription[role] : 'អ្នកប្រើនឹងមិនអាចប្រើ Dashboard បាន រហូតដល់បើកសិទ្ធិឡើងវិញ។ កំណត់ត្រាការកក់ត្រូវបានរក្សាទុក។'}</p>
      <p className="text-sm leading-6 text-slate-600">{user ? 'សិទ្ធិថ្មីត្រូវបានពិនិត្យនៅសំណើបន្ទាប់។ ផ្ទាំងដែលបើកស្រាប់ពិនិត្យសិទ្ធិឡើងវិញរៀងរាល់ ១ នាទី។' : 'គណនី Google នេះត្រូវមានស្រាប់។ ប្រព័ន្ធមិនផ្ញើ Email អញ្ជើញដោយស្វ័យប្រវត្តិទេ។'}</p>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => { setReview(false); setError(''); }}>ត្រឡប់កែ</Button><Button disabled={busy} onClick={() => void save()}>{busy ? 'កំពុងរក្សាទុក…' : 'បញ្ជាក់រក្សាទុក'}</Button></div>
    </> : <form onSubmit={prepare}><fieldset disabled={busy} className="grid gap-4">
      <label htmlFor="user-name" className="grid gap-2 text-sm font-semibold">ឈ្មោះ<Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" /></label>
      <label htmlFor="user-email" className="grid gap-2 text-sm font-semibold">Google Email<Input id="user-email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={!!user} required type="email" maxLength={254} autoComplete="email" aria-invalid={duplicate || undefined} aria-describedby="user-email-help" /></label>
      <p id="user-email-help" className={`text-sm ${duplicate ? 'text-red-700' : 'text-slate-500'}`}>{duplicate ? 'Email នេះមានរួចហើយ។ សូមបិទផ្ទាំងនេះ ហើយស្វែងរកដើម្បីកែអ្នកប្រើដែលមានស្រាប់។' : user ? 'Email ជាអត្តសញ្ញាណ Login និងមិនអាចកែនៅទីនេះ។' : 'ប្រើ Gmail ឬ Google Workspace ដែលអ្នកប្រើមានស្រាប់។'}</p>
      <label htmlFor="user-role" className="grid gap-2 text-sm font-semibold">តួនាទី<NativeSelect id="user-role" value={role} onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}><NativeSelectOption value="viewer">Viewer · មើលតែប៉ុណ្ណោះ</NativeSelectOption><NativeSelectOption value="editor">Editor · គ្រប់គ្រងការកក់</NativeSelectOption></NativeSelect></label>
      <p className="rounded-xl bg-blue-50 p-3 text-sm leading-7 text-blue-900">{roleDescription[role]}</p>
      <label htmlFor="user-active" className="grid gap-2 text-sm font-semibold">ការចូលប្រើ<NativeSelect id="user-active" value={active ? 'active' : 'inactive'} onChange={(e) => setActive(e.target.value === 'active')}><NativeSelectOption value="active">🟢 សកម្ម</NativeSelectOption><NativeSelectOption value="inactive">⛔ បានបិទ</NativeSelectOption></NativeSelect></label>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={requestClose}>បោះបង់</Button><Button type="submit" disabled={duplicate || (!!user && !changed)}>ពិនិត្យការផ្លាស់ប្តូរ</Button></div>
    </fieldset></form>}
  </div></Modal>;
}

export function UsersPanel() {
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [query, setQuery] = useState('');
  const [access, setAccess] = useState('all');
  const [role, setRole] = useState('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<{ user: DashboardUser | null } | null>(null);
  const [owner, setOwner] = useState<DashboardUser | null>(null);
  const [matrix, setMatrix] = useState(false);
  const visible = users.filter((u) => (u.email + ' ' + u.name).toLowerCase().includes(query.trim().toLowerCase()) && (access === 'all' || (access === 'active' ? u.active : !u.active)) && (role === 'all' || u.role === role));
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await dashboardFetch('/api/admin/users', { cache: 'no-store' });
      const result = await response.json() as { users?: DashboardUser[]; message?: string };
      if (!response.ok || !result.users) throw new Error(result.message || 'មិនអាចអានអ្នកប្រើបាន');
      setUsers(result.users);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'មិនអាចអានអ្នកប្រើបាន'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function submit(input: ReturnType<typeof parseUserInput>, create: boolean) {
    setMessage('');
    const response = await dashboardFetch('/api/admin/users', { method: create ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const result = await response.json() as { user?: DashboardUser; message?: string };
    if (!response.ok || !result.user) throw new Error(result.message || 'មិនអាចរក្សាទុកបាន');
    const saved = result.user;
    setUsers((items) => create ? [...items, saved] : items.map((item) => item.email === saved.email ? saved : item));
    setQuery(''); setAccess('all'); setRole('all');
    setMessage(`✅ ${create ? 'បានបន្ថែម' : 'បានរក្សាទុក'} ${saved.email} · ${roleLabel[saved.role]} · ${saved.active ? 'សកម្ម' : 'បានបិទ'}`);
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/dashboard`); setMessage('បានចម្លងតំណ Dashboard។ អ្នកអាចផ្ញើវាទៅអ្នកប្រើដែលបានផ្តល់សិទ្ធិ។'); }
    catch { setError('មិនអាចចម្លងបាន។ សូមចម្លងតំណពី Address Bar។'); }
  }

  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold">👥 គ្រប់គ្រងអ្នកប្រើ</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">កំណត់អ្នកដែលអាចចូល Dashboard និងមុខងារដែលពួកគេអាចប្រើ។ មានតែ Owner អាចកែសិទ្ធិនៅទីនេះ។</p></div><Button disabled={loading || !!error} onClick={() => setEditor({ user: null })}>➕ បន្ថែមអ្នកប្រើ</Button></div>
    <div className="flex flex-wrap gap-2"><Button variant="outline" aria-expanded={matrix} onClick={() => setMatrix(!matrix)}>តារាងសិទ្ធិ</Button><Button variant="outline" onClick={() => void copyLink()}>ចម្លងតំណ Login</Button></div>
    {matrix && <PermissionTable />}
    <p className="rounded-xl border bg-white p-4 text-sm leading-7 text-slate-600">អ្នកប្រើគ្រប់តួនាទីមើលការកក់គ្រប់ផ្នែក។ <a href="/request" className="font-semibold text-emerald-800 underline">Form ស្នើសុំ</a> ជាសាធារណៈ អាចប្រើដោយមិន Login។ ការបិទអ្នកប្រើបិទតែសិទ្ធិ Dashboard។</p>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error} <Button variant="outline" disabled={loading} onClick={() => void load()}>សាកល្បងម្ដងទៀត</Button></div>}
    {message && <output className="block rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</output>}
    <div className="overflow-hidden rounded-2xl border bg-white">
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_auto]">
        <Input aria-label="ស្វែងរកអ្នកប្រើ" placeholder="ស្វែងរកឈ្មោះ ឬ Email…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <NativeSelect aria-label="តម្រងតួនាទី" value={role} onChange={(e) => setRole(e.target.value)}><NativeSelectOption value="all">គ្រប់តួនាទី</NativeSelectOption>{(Object.keys(roleLabel) as DashboardRole[]).map((key) => <NativeSelectOption key={key} value={key}>{roleLabel[key]}</NativeSelectOption>)}</NativeSelect>
        <NativeSelect aria-label="ស្ថានភាពអ្នកប្រើ" value={access} onChange={(e) => setAccess(e.target.value)}><NativeSelectOption value="all">គ្រប់ស្ថានភាព</NativeSelectOption><NativeSelectOption value="active">សកម្ម</NativeSelectOption><NativeSelectOption value="inactive">បានបិទ</NativeSelectOption></NativeSelect>
        <Button variant="outline" disabled={loading} onClick={() => void load()}>Refresh</Button>
      </div>
      <output className="block px-4 pb-4 text-sm text-slate-500">{loading ? 'កំពុងទាញទិន្នន័យ…' : `បង្ហាញ ${visible.length} / ${users.length} នាក់ · សកម្ម ${users.filter((u) => u.active).length} · បានបិទ ${users.filter((u) => !u.active).length}`}</output>
      {!loading && !visible.length && <div className="border-t p-8 text-center"><p>មិនមានអ្នកប្រើតាមតម្រងនេះទេ។</p><Button variant="ghost" onClick={() => { setQuery(''); setRole('all'); setAccess('all'); }}>សម្អាតតម្រង</Button></div>}
      {!loading && visible.map((u) => <article key={u.email} className="grid gap-3 border-t p-4 sm:grid-cols-[minmax(0,1fr)_170px_auto] sm:items-center"><div className="min-w-0"><h3 className="break-words font-semibold">{u.name || u.email}</h3><p className="mt-1 break-all text-sm text-slate-600">{u.email}</p>{u.updatedAt && <p className="mt-2 break-words text-xs leading-6 text-slate-500">កែចុងក្រោយ៖ {new Date(u.updatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' })} · {u.updatedBy}</p>}</div><div className="text-sm"><p className="font-semibold">{roleLabel[u.role]}</p><p className={`mt-2 ${u.active ? 'text-emerald-700' : 'text-slate-500'}`}>{u.active ? '🟢 សកម្ម' : '⛔ បានបិទ'}</p></div><Button variant="outline" disabled={!!error} onClick={() => u.role === 'owner' ? setOwner(u) : setEditor({ user: u })}>{u.role === 'owner' ? '🔒 មើលសិទ្ធិ' : 'កែអ្នកប្រើ / សិទ្ធិ'}</Button></article>)}
    </div>
    {editor && <UserEditor user={editor.user} users={users} onClose={() => setEditor(null)} onSave={submit} />}
    {owner && <Modal title="👑 សិទ្ធិម្ចាស់ប្រព័ន្ធ" onClose={() => setOwner(null)}><div className="space-y-4 p-5"><p className="break-all font-semibold">{owner.email}</p><p className="text-sm leading-7">{roleDescription.owner}</p><p className="rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">គណនីម្ចាស់ប្រព័ន្ធត្រូវបានការពារ។ មិនអាចបិទ ឬប្តូរតួនាទីនៅក្នុងផ្ទាំងនេះ ដើម្បីជៀសវាងការបាត់សិទ្ធិគ្រប់គ្រង។</p><Button variant="outline" onClick={() => setOwner(null)}>បិទ</Button></div></Modal>}
  </section>;
}
