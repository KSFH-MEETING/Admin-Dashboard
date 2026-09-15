'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CircleAlert,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  availableInventory,
  parseInventoryInput,
  type InventoryInput,
  type InventoryItem,
} from '@/lib/inventory';
import { dashboardFetch } from '@/lib/dashboard-fetch';
import { Modal } from './modal';

const EMPTY: InventoryInput = {
  name: '',
  category: '',
  totalQty: 0,
  reservedQty: 0,
  inUseQty: 0,
  damagedQty: 0,
  location: '',
  active: true,
  notes: '',
};
const SUGGESTED_CATEGORIES = [
  'សំឡេង',
  'ការបង្ហាញ',
  'កុំព្យូទ័រ',
  'ខ្សែភ្ជាប់',
  'សម្ភារៈផ្សេងៗ',
];

function ItemStatus({ item }: { item: InventoryItem }) {
  const available = availableInventory(item);
  if (!item.active) return <Badge variant="secondary">⛔ បានបិទ</Badge>;
  if (!item.totalQty || !available)
    return <Badge variant="destructive">អស់ពីស្តុក</Badge>;
  if (item.damagedQty)
    return <Badge className="bg-amber-100 text-amber-900">⚠️ ត្រូវពិនិត្យ</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-800">✓ មានទំនេរ</Badge>;
}

function InventoryEditor({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem | null;
  onClose: () => void;
  onSaved: (item: InventoryItem, create: boolean) => void;
}) {
  const [form, setForm] = useState<InventoryInput>(
    item
      ? {
          name: item.name,
          category: item.category,
          totalQty: item.totalQty,
          reservedQty: item.reservedQty,
          inUseQty: item.inUseQty,
          damagedQty: item.damagedQty,
          location: item.location,
          active: item.active,
          notes: item.notes,
        }
      : EMPTY,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const available = Math.max(
    0,
    form.totalQty - form.reservedQty - form.inUseQty - form.damagedQty,
  );
  const setQuantity = (
    key: 'totalQty' | 'reservedQty' | 'inUseQty' | 'damagedQty',
    value: string,
  ) =>
    setForm((current) => ({
      ...current,
      [key]: value === '' ? 0 : Number(value),
    }));

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const input = parseInventoryInput(form);
      const response = await dashboardFetch('/api/admin/inventory', {
        method: item ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item ? { ...input, itemId: item.itemId } : input),
      });
      const result = (await response.json()) as {
        item?: InventoryItem;
        message?: string;
      };
      if (!response.ok || !result.item)
        throw new Error(result.message || 'មិនអាចរក្សាទុកសម្ភារៈបាន');
      onSaved(result.item, !item);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'មិនអាចរក្សាទុកបាន');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={item ? `✏️ កែសម្ភារៈ ${item.itemId}` : '➕ បន្ថែមសម្ភារៈ'}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit} className="space-y-5 p-5">
        <fieldset disabled={busy} className="grid gap-4">
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {!item && (
            <p className="rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-800">
              លេខសម្គាល់ខ្លីដូចជា EQ-001 នឹងត្រូវបង្កើតដោយស្វ័យប្រវត្តិ។
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label
              htmlFor="inventory-name"
              className="grid gap-2 text-sm font-semibold"
            >
              ឈ្មោះសម្ភារៈ
              <Input
                id="inventory-name"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                required
                maxLength={100}
                placeholder="ឧ. Projector"
              />
            </label>
            <label
              htmlFor="inventory-category"
              className="grid gap-2 text-sm font-semibold"
            >
              ប្រភេទ
              <Input
                id="inventory-category"
                list="inventory-categories"
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
                required
                maxLength={60}
                placeholder="ជ្រើស ឬបញ្ចូលថ្មី"
              />
              <datalist id="inventory-categories">
                {SUGGESTED_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </datalist>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label
              htmlFor="inventory-total"
              className="grid gap-2 text-sm font-semibold"
            >
              ចំនួនសរុប
              <Input
                id="inventory-total"
                type="number"
                min="0"
                max="9999"
                value={form.totalQty}
                onChange={(event) =>
                  setQuantity('totalQty', event.target.value)
                }
              />
            </label>
            <label
              htmlFor="inventory-reserved"
              className="grid gap-2 text-sm font-semibold"
            >
              បានកក់
              <Input
                id="inventory-reserved"
                type="number"
                min="0"
                max="9999"
                value={form.reservedQty}
                onChange={(event) =>
                  setQuantity('reservedQty', event.target.value)
                }
              />
            </label>
            <label
              htmlFor="inventory-in-use"
              className="grid gap-2 text-sm font-semibold"
            >
              កំពុងប្រើ
              <Input
                id="inventory-in-use"
                type="number"
                min="0"
                max="9999"
                value={form.inUseQty}
                onChange={(event) =>
                  setQuantity('inUseQty', event.target.value)
                }
              />
            </label>
            <label
              htmlFor="inventory-damaged"
              className="grid gap-2 text-sm font-semibold"
            >
              ខូច
              <Input
                id="inventory-damaged"
                type="number"
                min="0"
                max="9999"
                value={form.damagedQty}
                onChange={(event) =>
                  setQuantity('damagedQty', event.target.value)
                }
              />
            </label>
          </div>
          <output
            className={`rounded-xl p-3 text-sm font-semibold ${available >= 0 && form.reservedQty + form.inUseQty + form.damagedQty <= form.totalQty ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}
          >
            ចំនួនទំនេរ៖ {available}
          </output>
          <div className="grid gap-4 sm:grid-cols-2">
            <label
              htmlFor="inventory-location"
              className="grid gap-2 text-sm font-semibold"
            >
              ទីតាំងរក្សាទុក
              <Input
                id="inventory-location"
                value={form.location}
                onChange={(event) =>
                  setForm({ ...form, location: event.target.value })
                }
                maxLength={100}
                placeholder="ឧ. ទូសម្ភារៈ បន្ទប់រដ្ឋបាល"
              />
            </label>
            <label
              htmlFor="inventory-active"
              className="grid gap-2 text-sm font-semibold"
            >
              ស្ថានភាព
              <NativeSelect
                id="inventory-active"
                value={form.active ? 'active' : 'inactive'}
                onChange={(event) =>
                  setForm({ ...form, active: event.target.value === 'active' })
                }
              >
                <NativeSelectOption value="active">
                  🟢 កំពុងប្រើប្រាស់
                </NativeSelectOption>
                <NativeSelectOption value="inactive">
                  ⛔ បិទ Item
                </NativeSelectOption>
              </NativeSelect>
            </label>
          </div>
          <label
            htmlFor="inventory-notes"
            className="grid gap-2 text-sm font-semibold"
          >
            កំណត់ចំណាំ
            <Textarea
              id="inventory-notes"
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
              maxLength={500}
              rows={3}
              placeholder="ព័ត៌មានបន្ថែម ប្រសិនបើមាន"
            />
          </label>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              បោះបង់
            </Button>
            <Button type="submit">{busy ? 'កំពុងរក្សាទុក…' : 'រក្សាទុក'}</Button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

export function InventoryPanel({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<InventoryItem | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await dashboardFetch('/api/admin/inventory', {
        cache: 'no-store',
      });
      const result = (await response.json()) as {
        items?: InventoryItem[];
        message?: string;
      };
      if (!response.ok || !result.items)
        throw new Error(result.message || 'មិនអាចអានសម្ភារៈបាន');
      setItems(result.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'មិនអាចអានសម្ភារៈបាន');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const active = items.filter((item) => item.active);
  const summary = {
    total: active.reduce((sum, item) => sum + item.totalQty, 0),
    available: active.reduce((sum, item) => sum + availableInventory(item), 0),
    reserved: active.reduce((sum, item) => sum + item.reservedQty, 0),
    attention: active.reduce((sum, item) => sum + item.damagedQty, 0),
  };
  const visible = useMemo(
    () =>
      items.filter((item) => {
        const matchesQuery =
          `${item.itemId} ${item.name} ${item.category} ${item.location}`
            .toLowerCase()
            .includes(query.trim().toLowerCase());
        const available = availableInventory(item);
        const matchesStatus =
          status === 'all' ||
          (status === 'active' && item.active) ||
          (status === 'inactive' && !item.active) ||
          (status === 'attention' &&
            item.active &&
            (item.damagedQty > 0 || available === 0));
        return matchesQuery && matchesStatus;
      }),
    [items, query, status],
  );

  function saved(item: InventoryItem, create: boolean) {
    setItems((current) =>
      create
        ? [...current, item]
        : current.map((existing) =>
            existing.itemId === item.itemId ? item : existing,
          ),
    );
    setEditor(null);
    setNotice(
      `✅ ${create ? 'បានបន្ថែម' : 'បានកែ'} ${item.itemId} · ${item.name}`,
    );
  }

  return (
    <section className="space-y-5" aria-labelledby="inventory-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="inventory-title" className="text-xl font-bold">
            📦 Stock សម្ភារៈប្រជុំ
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            បញ្ជីស្តុកតូចសម្រាប់សម្ភារៈប្រជុំ · ចំនួនទំនេរគណនាដោយស្វ័យប្រវត្តិ
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setEditor('new')}
            disabled={loading || !!error}
          >
            <Plus /> បន្ថែមសម្ភារៈ
          </Button>
        )}
      </div>
      {!canManage && (
        <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
          👁️ អ្នកអាចមើល Stock បាន។ មានតែ Owner អាចបន្ថែម និងកែប្រែសម្ភារៈ។
        </p>
      )}
      {notice && (
        <output className="block rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </output>
      )}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          <span className="flex items-center gap-2">
            <CircleAlert className="size-4" />
            {error}
          </span>
          <Button variant="outline" onClick={() => void load()}>
            ព្យាយាមម្ដងទៀត
          </Button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['ស្តុកសរុប', summary.total, 'bg-slate-50 text-slate-800'],
          ['ទំនេរ', summary.available, 'bg-emerald-50 text-emerald-800'],
          ['បានកក់', summary.reserved, 'bg-blue-50 text-blue-800'],
          ['ខូច / ត្រូវពិនិត្យ', summary.attention, 'bg-amber-50 text-amber-900'],
        ].map(([label, value, color]) => (
          <div
            key={String(label)}
            className={`rounded-2xl border p-4 ${color}`}
          >
            <p className="text-sm">{label}</p>
            <p className="mt-2 text-2xl font-bold">{loading ? '…' : value}</p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="grid gap-3 border-b p-4 sm:grid-cols-[minmax(0,1fr)_190px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="ស្វែងរកសម្ភារៈ"
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ស្វែងរក ID ឈ្មោះ ឬទីតាំង…"
            />
          </div>
          <NativeSelect
            aria-label="តម្រងសម្ភារៈ"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <NativeSelectOption value="active">កំពុងប្រើប្រាស់</NativeSelectOption>
            <NativeSelectOption value="attention">ត្រូវពិនិត្យ</NativeSelectOption>
            <NativeSelectOption value="inactive">បានបិទ</NativeSelectOption>
            <NativeSelectOption value="all">ទាំងអស់</NativeSelectOption>
          </NativeSelect>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
        </div>
        <output className="block border-b bg-slate-50 px-4 py-3 text-sm text-slate-600">
          បង្ហាញ {visible.length} / {items.length} ប្រភេទសម្ភារៈ
        </output>
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            កំពុងទាញ Stock…
          </div>
        ) : !visible.length ? (
          <div className="p-12 text-center">
            <Package className="mx-auto mb-3 size-10 text-slate-300" />
            <p className="font-semibold">
              {items.length ? 'មិនមានលទ្ធផលតាមតម្រង' : 'មិនទាន់មានសម្ភារៈ'}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {items.length
                ? 'សូមប្តូរពាក្យស្វែងរក ឬតម្រង។'
                : canManage
                  ? 'ចុច «បន្ថែមសម្ភារៈ» ដើម្បីចាប់ផ្តើមបញ្ចូល Stock។'
                  : 'Owner នឹងបញ្ចូលបញ្ជីសម្ភារៈនៅទីនេះ។'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {visible.map((item) => (
              <article
                key={item.itemId}
                className="grid gap-4 p-4 sm:grid-cols-[minmax(180px,1fr)_minmax(240px,1.4fr)_auto] sm:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-emerald-900">{item.name}</h3>
                    <ItemStatus item={item} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.itemId} · {item.category}
                  </p>
                  <p className="mt-2 text-sm">
                    📍 {item.location || 'មិនទាន់កំណត់ទីតាំង'}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <strong className="block text-base">{item.totalQty}</strong>
                    សរុប
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800">
                    <strong className="block text-base">
                      {availableInventory(item)}
                    </strong>
                    ទំនេរ
                  </div>
                  <div className="rounded-lg bg-blue-50 p-2 text-blue-800">
                    <strong className="block text-base">
                      {item.reservedQty + item.inUseQty}
                    </strong>
                    កក់/ប្រើ
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2 text-amber-900">
                    <strong className="block text-base">
                      {item.damagedQty}
                    </strong>
                    ខូច
                  </div>
                  {item.notes && (
                    <p className="col-span-4 mt-1 text-left leading-5 text-slate-500">
                      📝 {item.notes}
                    </p>
                  )}
                </div>
                {canManage && (
                  <Button variant="outline" onClick={() => setEditor(item)}>
                    <Pencil /> កែប្រែ
                  </Button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
      <p className="rounded-xl border bg-white p-4 text-xs leading-6 text-slate-500">
        រូបមន្ត៖ ទំនេរ = ចំនួនសរុប − បានកក់ − កំពុងប្រើ − ខូច។ ប្រព័ន្ធមិនអនុញ្ញាតឱ្យផលបូកលើសចំនួនសរុបទេ។
      </p>
      {editor && (
        <InventoryEditor
          item={editor === 'new' ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
    </section>
  );
}
