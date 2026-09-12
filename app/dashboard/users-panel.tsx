'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal } from './modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { DashboardUser } from '@/lib/server/user-policy';

const roleLabel = { owner: 'ម្ចាស់ប្រព័ន្ធ', editor: 'គ្រប់គ្រង Booking', viewer: 'មើលតែប៉ុណ្ណោះ' };

function UserRow({ user, onSave }: { user: DashboardUser; onSave: (user: DashboardUser) => Promise<void> }) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const dirty = name !== user.name || role !== user.role;
  async function save(active: boolean, accessOnly = false) {
    if (saving) return;
    setSaving(true); setError('');
    try { await onSave(accessOnly ? { ...user, active } : { ...user, name, role, active }); setConfirming(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'មិនអាចរក្សាទុកបាន'); }
    finally { setSaving(false); }
  }
  return <article className="border-t p-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1"><p className="break-all text-sm font-semibold">{user.email}</p><p className={`mt-1 text-xs ${user.active ? 'text-emerald-700' : 'text-slate-500'}`}>{user.active ? '🟢 សកម្ម' : '⛔ បានបិទ'}</p></div>
      {user.role === 'owner' ? <p className="text-sm font-semibold text-emerald-800">👑 {roleLabel.owner}</p> : <>
        <Input aria-label={`ឈ្មោះ ${user.email}`} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} disabled={saving} className="h-10 lg:w-44" />
        <NativeSelect aria-label={`សិទ្ធិ ${user.email}`} value={role} onChange={(event) => setRole(event.target.value as 'viewer' | 'editor')} disabled={saving} className="lg:w-48 [&_select]:h-10"><NativeSelectOption value="viewer">👁️ {roleLabel.viewer}</NativeSelectOption><NativeSelectOption value="editor">✏️ {roleLabel.editor}</NativeSelectOption></NativeSelect>
        <div className="flex gap-2"><Button variant="outline" disabled={saving || !dirty} onClick={() => void save(user.active)}>{saving ? 'កំពុងរក្សាទុក…' : 'រក្សាទុក'}</Button>{dirty && <Button variant="ghost" disabled={saving} onClick={() => { setName(user.name); setRole(user.role); }}>បោះបង់</Button>}<Button variant={user.active ? 'destructive' : 'secondary'} disabled={saving} onClick={() => { setError(''); setConfirming(true); }}>{user.active ? 'បិទអ្នកប្រើ' : 'បើកអ្នកប្រើ'}</Button></div>
      </>}
    </div>
    {user.updatedAt && <p className="mt-3 text-xs text-slate-500">កែចុងក្រោយ៖ {new Date(user.updatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' })} · {user.updatedBy}</p>}
    {confirming && <Modal title={user.active ? 'បិទសិទ្ធិអ្នកប្រើ?' : 'បើកសិទ្ធិអ្នកប្រើ?'} busy={saving} onClose={() => setConfirming(false)}><div className="space-y-4 p-5"><p className="break-all font-semibold">{user.email}</p><p className="text-sm leading-6">{user.active ? 'អ្នកប្រើនេះនឹងមិនអាចចូល Dashboard បានទៀត។ កំណត់ត្រាការកក់នឹងរក្សាទុក។ អ្នកអាចបើកសិទ្ធិឡើងវិញបាន។' : 'អ្នកប្រើនេះនឹងអាចចូល Dashboard តាមសិទ្ធិដែលបានរក្សាទុក។'}</p>{error && <p role="alert" className="text-red-700">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={() => setConfirming(false)}>ត្រឡប់</Button><Button variant={user.active ? 'destructive' : 'default'} disabled={saving} onClick={() => void save(!user.active, true)}>{saving ? 'កំពុងរក្សាទុក…' : 'បញ្ជាក់'}</Button></div></div></Modal>}
    {error && !confirming && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
  </article>;
}

export function UsersPanel() {
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [query, setQuery] = useState('');
  const [access, setAccess] = useState('all');
  const visible = users.filter((user) => (user.email + ' ' + user.name).toLowerCase().includes(query.toLowerCase()) && (access === 'all' || (access === 'active' ? user.active : !user.active)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      const result = await response.json() as { users?: DashboardUser[]; message?: string };
      if (!response.ok || !result.users) throw new Error(result.message || 'មិនអាចអានអ្នកប្រើបាន');
      setUsers(result.users);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'មិនអាចអានអ្នកប្រើបាន'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(user: { email: string; name: string; role: string; active: boolean }, create: boolean) {
    setMessage('');
    const response = await fetch('/api/admin/users', { method: create ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user) });
    const result = await response.json() as { user?: DashboardUser; message?: string };
    if (!response.ok || !result.user) throw new Error(result.message || 'មិនអាចរក្សាទុកបាន');
    const saved = result.user;
    setUsers((items) => create ? [...items, saved] : items.map((item) => item.email === saved.email ? saved : item));
    setMessage(create ? '✅ បានបន្ថែមអ្នកប្រើ។ ពួកគេអាចចូល Dashboard ដោយគណនី Google នេះ។' : '✅ បានរក្សាទុកសិទ្ធិអ្នកប្រើ។');
  }

  async function add(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (key: string) => { const value = data.get(key); return typeof value === 'string' ? value : ''; };
    try {
      await submit({ email: text('email'), name: text('name'), role: text('role'), active: true }, true);
      form.reset();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'មិនអាចបន្ថែមអ្នកប្រើបាន'); }
    finally { setSaving(false); }
  }

  return <section className="space-y-5">
    <div><h2 className="text-lg font-bold">👥 គ្រប់គ្រងអ្នកប្រើ</h2><p className="mt-1 text-sm leading-6 text-slate-600">បន្ថែមគណនី Gmail ឬ Google Workspace ដែលមានស្រាប់។ អ្នកប្រើចូលដោយ Google ដោយមិនត្រូវការបង្កើត Password ថ្មី។ មានតែម្ចាស់ប្រព័ន្ធអាចកែសិទ្ធិនៅទីនេះ។</p><p className="mt-1 text-sm text-slate-500">Form ស្នើសុំបន្ទប់នៅតែជាសាធារណៈ។ សិទ្ធិខាងក្រោមអនុវត្តចំពោះ Dashboard។</p></div>
    <div className="grid gap-3 sm:grid-cols-3">{[['👑 ម្ចាស់ប្រព័ន្ធ', 'គ្រប់គ្រងការកក់ របាយការណ៍ និងសិទ្ធិអ្នកប្រើ។'], ['✏️ គ្រប់គ្រង Booking', 'មើល កែ និងលុបចោលការកក់។ មើល និងទាញយករបាយការណ៍។'], ['👁️ មើលតែប៉ុណ្ណោះ', 'មើលការកក់ និងទាញយករបាយការណ៍។ មិនអាចកែការកក់ ឬអ្នកប្រើ។']].map(([title, description]) => <div key={title} className="rounded-xl border bg-white p-4"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></div>)}</div>
    {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}
    {message && <output className="block rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</output>}
    <form onSubmit={add} className="grid gap-4 rounded-2xl border bg-white p-5 md:grid-cols-2 lg:grid-cols-[1fr_1.3fr_1fr_auto] lg:items-end">
      <label htmlFor="new-user-name" className="grid gap-2 text-sm font-semibold">ឈ្មោះ<Input id="new-user-name" name="name" required maxLength={100} disabled={saving || loading} className="h-10" /></label>
      <label htmlFor="new-user-email" className="grid gap-2 text-sm font-semibold">Google Email<Input id="new-user-email" name="email" type="email" required maxLength={254} disabled={saving || loading} placeholder="name@gmail.com" className="h-10" /></label>
      <label htmlFor="new-user-role" className="grid gap-2 text-sm font-semibold">សិទ្ធិ<NativeSelect id="new-user-role" name="role" defaultValue="viewer" disabled={saving || loading} className="[&_select]:h-10"><NativeSelectOption value="viewer">👁️ មើលតែប៉ុណ្ណោះ</NativeSelectOption><NativeSelectOption value="editor">✏️ គ្រប់គ្រង Booking</NativeSelectOption></NativeSelect></label>
      <Button type="submit" disabled={saving || loading}>{saving ? 'កំពុងបន្ថែម…' : '➕ បន្ថែមអ្នកប្រើ'}</Button>
    </form>
    <div className="overflow-hidden rounded-2xl border bg-white"><div className="flex flex-col gap-3 p-4 sm:flex-row"><Input aria-label="ស្វែងរកអ្នកប្រើ" placeholder="ស្វែងរកឈ្មោះ ឬ Email…" value={query} onChange={(e) => setQuery(e.target.value)} /><NativeSelect aria-label="ស្ថានភាពអ្នកប្រើ" value={access} onChange={(e) => setAccess(e.target.value)}><NativeSelectOption value="all">ទាំងអស់</NativeSelectOption><NativeSelectOption value="active">សកម្ម</NativeSelectOption><NativeSelectOption value="inactive">បានបិទ</NativeSelectOption></NativeSelect></div><div className="flex items-center justify-between p-4"><h3 className="font-semibold">អ្នកប្រើ {visible.length} / {users.length} នាក់</h3><Button variant="outline" disabled={loading} onClick={() => void load()}>Refresh</Button></div>{loading ? <p className="p-5 text-sm text-slate-500">កំពុងទាញទិន្នន័យ…</p> : visible.length === 0 ? <p className="p-5 text-sm text-slate-500">មិនមានអ្នកប្រើតាមតម្រងនេះទេ។</p> : visible.map((user) => <UserRow key={`${user.email}:${user.updatedAt}`} user={user} onSave={(value) => submit(value, false)} />)}</div>
  </section>;
}
