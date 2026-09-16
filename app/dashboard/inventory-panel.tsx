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
  type InventoryAllocation,
  type InventoryAllocationStatus,
  type InventoryCondition,
  type InventoryInput,
  type InventoryItem,
} from '@/lib/inventory';
import { dashboardFetch } from '@/lib/dashboard-fetch';
import { ROOMS } from '@/lib/meeting-config';
import { Modal } from './modal';

const EMPTY: InventoryInput = {
  name: '',
  category: '',
  brand: '',
  model: '',
  serialNumber: '',
  acquiredDate: '',
  warrantyExpiry: '',
  condition: 'good',
  responsiblePerson: '',
  specification: '',
  totalQty: 1,
  reservedQty: 0,
  inUseQty: 0,
  damagedQty: 0,
  location: '',
  allocations: [{ location: '', status: 'available', quantity: 1 }],
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
const LOCATION_OPTIONS = [...ROOMS, 'បន្ទប់សម្ភារៈ I.T'] as const;
const CUSTOM_LOCATION = '__custom__';
const CONDITION_LABELS: Record<InventoryCondition, string> = {
  new: '✨ ថ្មី',
  good: '✅ ល្អ',
  repair: '🛠️ ត្រូវជួសជុល',
  damaged: '⛔ ខូច',
};
const ALLOCATION_STATUS_LABELS: Record<InventoryAllocationStatus, string> = {
  available: '🟢 ទំនេរ',
  reserved: '🔵 បានកក់',
  in_use: '🟣 កំពុងប្រើ',
  damaged: '🟠 ខូច / ត្រូវពិនិត្យ',
};
type AllocationRow = InventoryAllocation & { id: string; custom: boolean };
const allocationRow = (value?: InventoryAllocation): AllocationRow => ({
  id: crypto.randomUUID(),
  location: value?.location || '',
  status: value?.status || 'available',
  quantity: value?.quantity || 1,
  custom: Boolean(value?.location && !LOCATION_OPTIONS.includes(value.location as (typeof LOCATION_OPTIONS)[number])),
});

function FieldRequirement({ required = false }: { required?: boolean }) {
  return (
    <small className={required ? 'text-red-600' : 'font-normal text-slate-500'}>
      {required ? '* ចាំបាច់' : '(មិនចាំបាច់)'}
    </small>
  );
}

function ItemStatus({ item }: { item: InventoryItem }) {
  const available = availableInventory(item);
  if (!item.active) return <Badge variant="secondary">⛔ បានបិទ</Badge>;
  if (item.condition === 'damaged')
    return <Badge variant="destructive">⛔ ខូច</Badge>;
  if (item.condition === 'repair')
    return <Badge className="bg-amber-100 text-amber-900">🛠️ ត្រូវជួសជុល</Badge>;
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
          brand: item.brand,
          model: item.model,
          serialNumber: item.serialNumber,
          acquiredDate: item.acquiredDate,
          warrantyExpiry: item.warrantyExpiry,
          condition: item.condition,
          responsiblePerson: item.responsiblePerson,
          specification: item.specification,
          totalQty: item.totalQty,
          reservedQty: item.reservedQty,
          inUseQty: item.inUseQty,
          damagedQty: item.damagedQty,
          location: item.location,
          allocations: item.allocations,
          active: item.active,
          notes: item.notes,
        }
      : EMPTY,
  );
  const [allocationRows, setAllocationRows] = useState<AllocationRow[]>(
    item?.allocations?.length
      ? item.allocations.map((allocation) => allocationRow(allocation))
      : [allocationRow()],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const allocationTotal = allocationRows.reduce((sum, row) => sum + row.quantity, 0);
  const allocationTotals = Object.fromEntries(
    Object.keys(ALLOCATION_STATUS_LABELS).map((status) => [
      status,
      allocationRows.filter((row) => row.status === status).reduce((sum, row) => sum + row.quantity, 0),
    ]),
  ) as Record<InventoryAllocationStatus, number>;

  function updateAllocation(id: string, change: Partial<AllocationRow>) {
    setAllocationRows((rows) => rows.map((row) => row.id === id ? { ...row, ...change } : row));
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const allocations = allocationRows.map(({ location, status, quantity }) => ({ location, status, quantity }));
      const input = parseInventoryInput({
        ...form,
        allocations,
        location: allocations[0]?.location || '',
        reservedQty: allocationTotals.reserved,
        inUseQty: allocationTotals.in_use,
        damagedQty: allocationTotals.damaged,
      });
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
          <p className="text-xs leading-5 text-slate-600">
            Field ដែលមាន{' '}
            <span className="font-semibold text-red-600">* ចាំបាច់</span> ត្រូវបំពេញ។
            Field ផ្សេងអាចទុកទទេបាន។
          </p>
          <h3 className="border-b pb-2 font-bold text-emerald-900">
            1. ព័ត៌មានសម្ភារៈ
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label
              htmlFor="inventory-name"
              className="grid gap-2 text-sm font-semibold"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                ឈ្មោះសម្ភារៈ <FieldRequirement required />
              </span>
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
              <span className="flex flex-wrap items-center justify-between gap-2">
                ប្រភេទ <FieldRequirement required />
              </span>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label
              htmlFor="inventory-brand"
              className="grid gap-2 text-sm font-semibold"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                Brand <FieldRequirement />
              </span>
              <Input
                id="inventory-brand"
                value={form.brand}
                onChange={(event) =>
                  setForm({ ...form, brand: event.target.value })
                }
                maxLength={80}
                placeholder="ឧ. Dell, Epson, Logitech"
              />
            </label>
            <label
              htmlFor="inventory-model"
              className="grid gap-2 text-sm font-semibold"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                Model <FieldRequirement />
              </span>
              <Input
                id="inventory-model"
                value={form.model}
                onChange={(event) =>
                  setForm({ ...form, model: event.target.value })
                }
                maxLength={100}
                placeholder="ឧ. Latitude 5540"
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label
              htmlFor="inventory-serial"
              className="grid gap-2 text-sm font-semibold"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                Serial Number (SN) <FieldRequirement />
              </span>
              <Input
                id="inventory-serial"
                value={form.serialNumber}
                onChange={(event) => {
                  const serialNumber = event.target.value;
                  setForm((current) => ({
                    ...current,
                    serialNumber,
                    totalQty: serialNumber.trim() ? 1 : current.totalQty,
                  }));
                  if (serialNumber.trim())
                    setAllocationRows((rows) => [
                      { ...(rows[0] || allocationRow()), quantity: 1 },
                    ]);
                }}
                maxLength={100}
                placeholder="អាចទុកទទេ ប្រសិនបើគ្មាន SN"
              />
            </label>
            <label
              htmlFor="inventory-acquired-date"
              className="grid gap-2 text-sm font-semibold"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                ថ្ងៃទិញ / ទទួល <FieldRequirement />
              </span>
              <Input
                id="inventory-acquired-date"
                type="date"
                value={form.acquiredDate}
                onChange={(event) =>
                  setForm({ ...form, acquiredDate: event.target.value })
                }
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label
              htmlFor="inventory-warranty"
              className="grid gap-2 text-sm font-semibold"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                ថ្ងៃផុតការធានា <FieldRequirement />
              </span>
              <Input
                id="inventory-warranty"
                type="date"
                min={form.acquiredDate || undefined}
                value={form.warrantyExpiry}
                onChange={(event) =>
                  setForm({ ...form, warrantyExpiry: event.target.value })
                }
              />
            </label>
            <label
              htmlFor="inventory-responsible"
              className="grid gap-2 text-sm font-semibold"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                អ្នកទទួលខុសត្រូវ / ផ្នែក <FieldRequirement />
              </span>
              <Input
                id="inventory-responsible"
                value={form.responsiblePerson}
                onChange={(event) =>
                  setForm({ ...form, responsiblePerson: event.target.value })
                }
                maxLength={120}
                placeholder="ឧ. ផ្នែកព័ត៌មានវិទ្យា"
              />
            </label>
          </div>
          <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            ប្រសិនបើសម្ភារៈមួយមាន SN ផ្ទាល់ខ្លួន គួរបង្កើតជា Item មួយ និងដាក់ចំនួនសរុប 1។
            សម្ភារៈជាក្រុមអាចទុក SN ឱ្យទទេ។
          </p>
          <label
            htmlFor="inventory-specification"
            className="grid gap-2 text-sm font-semibold"
          >
            <span className="flex flex-wrap items-center justify-between gap-2">
              Specification <FieldRequirement />
            </span>
            <Textarea
              id="inventory-specification"
              value={form.specification}
              onChange={(event) =>
                setForm({ ...form, specification: event.target.value })
              }
              maxLength={1000}
              rows={3}
              placeholder="ឧ. CPU, RAM, SSD, ទំហំ, Port ឬលក្ខណៈបច្ចេកទេស"
            />
          </label>
          <h3 className="border-b pb-2 font-bold text-emerald-900">
            2. ចំនួន Stock
          </h3>
          <div className="grid gap-3 sm:grid-cols-[minmax(180px,260px)_1fr] sm:items-end">
            <label
              htmlFor="inventory-total"
              className="grid gap-2 text-sm font-semibold"
            >
              <span className="flex flex-wrap items-center justify-between gap-1">
                ចំនួនសរុប <FieldRequirement required />
              </span>
              <Input
                id="inventory-total"
                type="number"
                min="1"
                max="9999"
                value={form.totalQty}
                disabled={Boolean(form.serialNumber.trim())}
                onChange={(event) => {
                  const totalQty = event.target.value === '' ? 0 : Number(event.target.value);
                  setForm((current) => ({ ...current, totalQty }));
                  if (allocationRows.length === 1)
                    setAllocationRows((rows) => rows.map((row) => ({ ...row, quantity: totalQty })));
                }}
              />
            </label>
            <output className={`rounded-xl p-3 text-sm font-semibold ${allocationTotal === form.totalQty ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
              បានបែងចែក៖ {allocationTotal} / {form.totalQty}
              {allocationTotal !== form.totalQty && ' · សូមកែឱ្យចំនួនស្មើគ្នា'}
            </output>
          </div>
          {form.serialNumber.trim() && (
            <p className="text-xs text-blue-700">
              🔖 មាន SN៖ ប្រព័ន្ធកំណត់ចំនួនសរុបជា 1 ដោយស្វ័យប្រវត្តិ។
            </p>
          )}
          <h3 className="border-b pb-2 font-bold text-emerald-900">
            3. ទីតាំង និងស្ថានភាព
          </h3>
          <p className="rounded-xl bg-blue-50 p-3 text-xs leading-6 text-blue-800">
            បន្ថែមមួយជួរសម្រាប់ទីតាំង និងស្ថានភាពនីមួយៗ។ ឧទាហរណ៍ Pointer 4 អាចចែកជា 4 ជួរនៅបន្ទប់ផ្សេងគ្នា។
          </p>
          <div className="grid gap-3">
            {allocationRows.map((row, index) => (
              <div key={row.id} className="grid gap-3 rounded-xl border bg-slate-50 p-3 lg:grid-cols-[minmax(220px,1fr)_190px_120px_auto] lg:items-end">
                <div className="grid gap-2">
                  <label htmlFor={`inventory-location-${row.id}`} className="text-sm font-semibold">ទីតាំង #{index + 1} <FieldRequirement required /></label>
                  <NativeSelect id={`inventory-location-${row.id}`} value={row.custom ? CUSTOM_LOCATION : row.location} onChange={(event) => { const value = event.target.value; updateAllocation(row.id, { custom: value === CUSTOM_LOCATION, location: value === CUSTOM_LOCATION ? '' : value }); }} required>
                    <NativeSelectOption value="">ជ្រើសទីតាំង</NativeSelectOption>
                    {LOCATION_OPTIONS.map((location) => <NativeSelectOption key={location} value={location}>{location}</NativeSelectOption>)}
                    <NativeSelectOption value={CUSTOM_LOCATION}>ផ្សេងៗ (បំពេញដោយខ្លួនឯង)</NativeSelectOption>
                  </NativeSelect>
                  {row.custom && <Input aria-label={`បញ្ចូលទីតាំងផ្សេងៗ ជួរ ${index + 1}`} value={row.location} onChange={(event) => updateAllocation(row.id, { location: event.target.value })} required maxLength={100} placeholder="បញ្ចូលឈ្មោះទីតាំង" />}
                </div>
                <label htmlFor={`inventory-allocation-status-${row.id}`} className="grid gap-2 text-sm font-semibold">ស្ថានភាព<NativeSelect id={`inventory-allocation-status-${row.id}`} value={row.status} onChange={(event) => updateAllocation(row.id, { status: event.target.value as InventoryAllocationStatus })}>{Object.entries(ALLOCATION_STATUS_LABELS).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect></label>
                <label htmlFor={`inventory-allocation-quantity-${row.id}`} className="grid gap-2 text-sm font-semibold">ចំនួន<Input id={`inventory-allocation-quantity-${row.id}`} type="number" min="1" max="9999" value={row.quantity} onChange={(event) => updateAllocation(row.id, { quantity: event.target.value === '' ? 0 : Number(event.target.value) })} /></label>
                <Button type="button" variant="outline" disabled={allocationRows.length === 1 || Boolean(form.serialNumber.trim())} onClick={() => setAllocationRows((rows) => rows.filter((candidate) => candidate.id !== row.id))}>លុបជួរ</Button>
              </div>
            ))}
            <Button type="button" variant="outline" disabled={Boolean(form.serialNumber.trim()) || allocationRows.length >= 100} onClick={() => setAllocationRows((rows) => [...rows, allocationRow()])}><Plus /> បន្ថែមទីតាំង / ស្ថានភាព</Button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
            {Object.entries(ALLOCATION_STATUS_LABELS).map(([value, label]) => <div key={value} className="rounded-lg border bg-white p-3"><strong className="block text-lg">{allocationTotals[value as InventoryAllocationStatus]}</strong>{label}</div>)}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label
              htmlFor="inventory-condition"
              className="grid gap-2 text-sm font-semibold"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                ស្ថានភាពសម្ភារៈ <FieldRequirement required />
              </span>
              <NativeSelect
                id="inventory-condition"
                value={form.condition}
                onChange={(event) =>
                  setForm({
                    ...form,
                    condition: event.target.value as InventoryCondition,
                  })
                }
                required
              >
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <label
              htmlFor="inventory-active"
              className="grid gap-2 text-sm font-semibold"
            >
              ស្ថានភាពក្នុងប្រព័ន្ធ
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
            <span className="flex flex-wrap items-center justify-between gap-2">
              កំណត់ចំណាំ <FieldRequirement />
            </span>
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
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
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
  const categories = [
    ...new Set(items.map((item) => item.category).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  const locations = [
    ...new Set(items.flatMap((item) => item.allocations.map((row) => row.location)).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  const summary = {
    total: active.reduce((sum, item) => sum + item.totalQty, 0),
    available: active.reduce((sum, item) => sum + availableInventory(item), 0),
    reserved: active.reduce((sum, item) => sum + item.reservedQty + item.inUseQty, 0),
    attention: active.reduce(
      (sum, item) =>
        sum +
        item.damagedQty +
        ((item.condition === 'repair' || item.condition === 'damaged') &&
        item.damagedQty === 0
          ? 1
          : 0),
      0,
    ),
  };
  const locationSummary = locations.map((location) => ({
    location,
    quantity: active.reduce(
      (sum, item) => sum + item.allocations.filter((row) => row.location === location).reduce((rowSum, row) => rowSum + row.quantity, 0),
      0,
    ),
  }));
  const visible = useMemo(
    () =>
      items.filter((item) => {
        const matchesQuery =
          `${item.itemId} ${item.name} ${item.category} ${item.brand} ${item.model} ${item.serialNumber} ${item.specification} ${item.responsiblePerson} ${item.allocations.map((row) => row.location).join(' ')}`
            .toLowerCase()
            .includes(query.trim().toLowerCase());
        const available = availableInventory(item);
        const matchesStatus =
          status === 'all' ||
          (status === 'active' && item.active) ||
          (status === 'inactive' && !item.active) ||
          (status === 'available' && item.active && available > 0) ||
          (status === 'occupied' && item.active && (item.reservedQty > 0 || item.inUseQty > 0)) ||
          (status === 'reserved' && item.active && item.reservedQty > 0) ||
          (status === 'in_use' && item.active && item.inUseQty > 0) ||
          (status === 'damaged' && item.active && item.damagedQty > 0) ||
          (status === 'attention' &&
            item.active &&
            (item.damagedQty > 0 ||
              available === 0 ||
              item.condition === 'repair' ||
              item.condition === 'damaged'));
        const matchesCategory =
          categoryFilter === 'all' || item.category === categoryFilter;
        const matchesLocation =
          locationFilter === 'all' || item.allocations.some((row) => row.location === locationFilter);
        return (
          matchesQuery && matchesStatus && matchesCategory && matchesLocation
        );
      }),
    [items, query, status, categoryFilter, locationFilter],
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
          { label: 'ស្តុកសរុប', value: summary.total, color: 'bg-slate-50 text-slate-800', filter: 'active' },
          { label: 'ទំនេរ', value: summary.available, color: 'bg-emerald-50 text-emerald-800', filter: 'available' },
          { label: 'កក់ / កំពុងប្រើ', value: summary.reserved, color: 'bg-blue-50 text-blue-800', filter: 'occupied' },
          { label: 'ខូច / ត្រូវពិនិត្យ', value: summary.attention, color: 'bg-amber-50 text-amber-900', filter: 'attention' },
        ].map((card) => (
          <button
            type="button"
            key={card.label}
            aria-pressed={status === card.filter}
            onClick={() => { setStatus(card.filter); setLocationFilter('all'); }}
            className={`rounded-2xl border p-4 text-left transition hover:border-emerald-500 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 aria-pressed:ring-2 aria-pressed:ring-emerald-600 ${card.color}`}
          >
            <p className="text-sm">{card.label}</p>
            <p className="mt-2 text-2xl font-bold">{loading ? '…' : card.value}</p>
            <span className="mt-2 block text-xs font-medium">ចុចមើល →</span>
          </button>
        ))}
      </div>
      <section aria-labelledby="inventory-location-summary" className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 id="inventory-location-summary" className="font-bold">📍 Summary តាមទីតាំង</h3><p className="mt-1 text-xs text-slate-500">ចុចទីតាំង ដើម្បីចម្រាញ់បញ្ជីសម្ភារៈ</p></div><Button variant="ghost" aria-pressed={locationFilter === 'all'} onClick={() => setLocationFilter('all')}>គ្រប់ទីតាំង · {summary.total}</Button></div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {locationSummary.map((entry) => <button type="button" key={entry.location} aria-pressed={locationFilter === entry.location} onClick={() => setLocationFilter(entry.location)} className="flex h-11 shrink-0 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-medium hover:border-emerald-500 focus-visible:outline-2 focus-visible:outline-emerald-700 aria-pressed:border-emerald-700 aria-pressed:bg-emerald-50 aria-pressed:text-emerald-800"><span>{entry.location}</span><strong className="rounded-full bg-slate-100 px-2 py-0.5">{entry.quantity}</strong></button>)}
        </div>
      </section>
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_170px_170px_190px_auto]">
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
            aria-label="តម្រងប្រភេទសម្ភារៈ"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <NativeSelectOption value="all">គ្រប់ប្រភេទ</NativeSelectOption>
            {categories.map((category) => (
              <NativeSelectOption key={category} value={category}>
                {category}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="តម្រងទីតាំងសម្ភារៈ"
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
          >
            <NativeSelectOption value="all">គ្រប់ទីតាំង</NativeSelectOption>
            {locations.map((location) => (
              <NativeSelectOption key={location} value={location}>
                {location}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="តម្រងសម្ភារៈ"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <NativeSelectOption value="active">កំពុងប្រើប្រាស់</NativeSelectOption>
            <NativeSelectOption value="available">មានទំនេរ</NativeSelectOption>
            <NativeSelectOption value="occupied">បានកក់ / កំពុងប្រើ</NativeSelectOption>
            <NativeSelectOption value="reserved">បានកក់</NativeSelectOption>
            <NativeSelectOption value="in_use">កំពុងប្រើ</NativeSelectOption>
            <NativeSelectOption value="damaged">ខូច</NativeSelectOption>
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
          បង្ហាញ {visible.length} / {items.length} សម្ភារៈ · ប្រភេទ៖{' '}
          {categoryFilter === 'all' ? 'ទាំងអស់' : categoryFilter} · ទីតាំង៖{' '}
          {locationFilter === 'all' ? 'ទាំងអស់' : locationFilter}
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
          <div className="grid gap-4 bg-slate-50/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {visible.map((item) => (
              <article
                key={item.itemId}
                className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-emerald-900">{item.name}</h3>
                    <ItemStatus item={item} />
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {item.itemId}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-800">
                      🏷️ {item.category}
                    </span>
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-800">
                      📍 {new Set(item.allocations.map((row) => row.location)).size === 1 ? item.allocations[0]?.location : `${new Set(item.allocations.map((row) => row.location)).size} ទីតាំង`}
                    </span>
                  </div>
                  {(item.brand || item.model) && (
                    <p className="mt-2 text-xs font-medium text-slate-700">
                      {item.brand} {item.model}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-600">
                    🔖 {item.serialNumber || 'គ្មាន SN'} · 📅{' '}
                    {item.acquiredDate || 'មិនទាន់កំណត់ថ្ងៃ'}
                  </p>
                  <p className="mt-2 text-xs text-slate-600">
                    {CONDITION_LABELS[item.condition]}
                    {item.warrantyExpiry
                      ? ` · 🛡️ ធានាដល់ ${item.warrantyExpiry}`
                      : ''}
                  </p>
                  {item.responsiblePerson && (
                    <p className="mt-2 text-xs text-slate-600">
                      👤 {item.responsiblePerson}
                    </p>
                  )}
                  {item.specification && (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                      ⚙️ {item.specification}
                    </p>
                  )}
                  <div className="mt-3 grid gap-1.5 rounded-xl bg-slate-50 p-2.5 text-xs">
                    <p className="font-semibold text-slate-700">ចែកចាយតាមទីតាំង</p>
                    {item.allocations.map((row) => <div key={`${row.location}-${row.status}`} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${locationFilter === row.location ? 'bg-emerald-100 text-emerald-900' : 'bg-white'}`}><span className="min-w-0 truncate" title={row.location}>📍 {row.location}</span><span className="shrink-0 font-medium">{ALLOCATION_STATUS_LABELS[row.status]} · {row.quantity}</span></div>)}
                  </div>
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
                  <Button
                    className="mt-auto w-full"
                    variant="outline"
                    onClick={() => setEditor(item)}
                  >
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
