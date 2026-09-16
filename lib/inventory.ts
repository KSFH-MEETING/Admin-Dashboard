export type InventoryItem = {
  itemId: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  acquiredDate: string;
  warrantyExpiry: string;
  condition: InventoryCondition;
  responsiblePerson: string;
  specification: string;
  totalQty: number;
  reservedQty: number;
  inUseQty: number;
  damagedQty: number;
  location: string;
  allocations: InventoryAllocation[];
  active: boolean;
  notes: string;
  updatedAt: string;
  updatedBy: string;
};

export const INVENTORY_ALLOCATION_STATUSES = [
  'available',
  'reserved',
  'in_use',
  'damaged',
] as const;
export type InventoryAllocationStatus =
  (typeof INVENTORY_ALLOCATION_STATUSES)[number];
export type InventoryAllocation = {
  location: string;
  status: InventoryAllocationStatus;
  quantity: number;
};

export const INVENTORY_CONDITIONS = [
  'new',
  'good',
  'repair',
  'damaged',
] as const;
export type InventoryCondition = (typeof INVENTORY_CONDITIONS)[number];

export type InventoryInput = Omit<
  InventoryItem,
  'itemId' | 'updatedAt' | 'updatedBy'
>;

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

function quantity(value: unknown, label: string, minimum = 0) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(number) || number < minimum || number > 9999)
    throw new Error(`${label} ត្រូវជាលេខពេញចន្លោះ ${minimum} ដល់ 9999`);
  return number;
}

function optionalDate(value: unknown, label: string) {
  const result = text(value, 10);
  if (!result) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(result);
  const date = match
    ? new Date(
        Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
      )
    : null;
  if (
    !match ||
    !date ||
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  )
    throw new Error(`${label}មិនត្រឹមត្រូវ`);
  return result;
}

function legacyAllocations(
  location: string,
  totalQty: number,
  reservedQty: number,
  inUseQty: number,
  damagedQty: number,
) {
  const result: InventoryAllocation[] = [];
  const available = totalQty - reservedQty - inUseQty - damagedQty;
  if (available) result.push({ location, status: 'available', quantity: available });
  if (reservedQty) result.push({ location, status: 'reserved', quantity: reservedQty });
  if (inUseQty) result.push({ location, status: 'in_use', quantity: inUseQty });
  if (damagedQty) result.push({ location, status: 'damaged', quantity: damagedQty });
  return result;
}

function parseAllocations(
  value: unknown,
  legacy: {
    location: string;
    totalQty: number;
    reservedQty: number;
    inUseQty: number;
    damagedQty: number;
  },
) {
  if (!Array.isArray(value) || value.length === 0) {
    if (!legacy.location) throw new Error('សូមជ្រើស ឬបញ្ចូលទីតាំងរក្សាទុក');
    return legacyAllocations(
      legacy.location,
      legacy.totalQty,
      legacy.reservedQty,
      legacy.inUseQty,
      legacy.damagedQty,
    );
  }
  if (value.length > 100) throw new Error('ការចែកចាយមិនអាចលើស 100 ជួរ');
  const merged = new Map<string, InventoryAllocation>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') throw new Error('ព័ត៌មានចែកចាយមិនត្រឹមត្រូវ');
    const row = raw as Record<string, unknown>;
    const location = text(row.location, 100);
    const status = text(row.status, 20) as InventoryAllocationStatus;
    const rowQuantity = quantity(row.quantity, 'ចំនួនតាមទីតាំង', 1);
    if (!location) throw new Error('សូមជ្រើស ឬបញ្ចូលទីតាំងគ្រប់ជួរ');
    if (!INVENTORY_ALLOCATION_STATUSES.includes(status))
      throw new Error('ស្ថានភាពចែកចាយមិនត្រឹមត្រូវ');
    const key = `${location}\u0000${status}`;
    const existing = merged.get(key);
    merged.set(key, {
      location,
      status,
      quantity: (existing?.quantity || 0) + rowQuantity,
    });
  }
  const allocations = [...merged.values()];
  if (allocations.reduce((sum, row) => sum + row.quantity, 0) !== legacy.totalQty)
    throw new Error('ផលបូកចំនួនតាមទីតាំង និងស្ថានភាព ត្រូវស្មើចំនួនសរុប');
  return allocations;
}

export function parseInventoryInput(value: unknown): InventoryInput {
  if (!value || typeof value !== 'object') throw new Error('សូមបំពេញព័ត៌មានសម្ភារៈ');
  const data = value as Record<string, unknown>;
  const name = text(data.name, 100);
  const category = text(data.category, 60);
  const brand = text(data.brand, 80);
  const model = text(data.model, 100);
  const serialNumber = text(data.serialNumber, 100);
  const acquiredDate = optionalDate(data.acquiredDate, 'ថ្ងៃទិញ / ទទួល');
  const warrantyExpiry = optionalDate(data.warrantyExpiry, 'ថ្ងៃផុតការធានា');
  const condition = text(data.condition, 20) as InventoryCondition;
  const responsiblePerson = text(data.responsiblePerson, 120);
  const specification = text(data.specification, 1000);
  const legacyLocation = text(data.location, 100);
  const notes = text(data.notes, 500);
  const totalQty = quantity(data.totalQty, 'ចំនួនសរុប', 1);
  const reservedQty = quantity(data.reservedQty, 'ចំនួនបានកក់');
  const inUseQty = quantity(data.inUseQty, 'ចំនួនកំពុងប្រើ');
  const damagedQty = quantity(data.damagedQty, 'ចំនួនខូច');
  if (!name) throw new Error('សូមបញ្ចូលឈ្មោះសម្ភារៈ');
  if (!category) throw new Error('សូមបញ្ចូលប្រភេទសម្ភារៈ');
  if (!INVENTORY_CONDITIONS.includes(condition))
    throw new Error('សូមជ្រើសស្ថានភាពរបស់សម្ភារៈ');
  if (serialNumber && totalQty !== 1)
    throw new Error('សម្ភារៈដែលមាន SN ត្រូវមានចំនួនសរុប 1');
  if (acquiredDate && warrantyExpiry && warrantyExpiry < acquiredDate)
    throw new Error('ថ្ងៃផុតការធានាត្រូវនៅក្រោយថ្ងៃទិញ / ទទួល');
  if (typeof data.active !== 'boolean') throw new Error('ស្ថានភាពសម្ភារៈមិនត្រឹមត្រូវ');
  if (reservedQty + inUseQty + damagedQty > totalQty)
    throw new Error('ចំនួនបានកក់ កំពុងប្រើ និងខូច មិនអាចលើសចំនួនសរុប');
  const allocations = parseAllocations(data.allocations, {
    location: legacyLocation,
    totalQty,
    reservedQty,
    inUseQty,
    damagedQty,
  });
  const derivedReserved = allocations
    .filter((row) => row.status === 'reserved')
    .reduce((sum, row) => sum + row.quantity, 0);
  const derivedInUse = allocations
    .filter((row) => row.status === 'in_use')
    .reduce((sum, row) => sum + row.quantity, 0);
  const derivedDamaged = allocations
    .filter((row) => row.status === 'damaged')
    .reduce((sum, row) => sum + row.quantity, 0);
  const uniqueLocations = [...new Set(allocations.map((row) => row.location))];
  const location = uniqueLocations.length === 1 ? uniqueLocations[0] : 'ច្រើនទីតាំង';
  return {
    name,
    category,
    brand,
    model,
    serialNumber,
    acquiredDate,
    warrantyExpiry,
    condition,
    responsiblePerson,
    specification,
    totalQty,
    reservedQty: derivedReserved,
    inUseQty: derivedInUse,
    damagedQty: derivedDamaged,
    location,
    allocations,
    active: data.active,
    notes,
  };
}

export function availableInventory(
  item: Pick<
    InventoryItem,
    'active' | 'totalQty' | 'reservedQty' | 'inUseQty' | 'damagedQty'
  >,
) {
  return item.active
    ? Math.max(
        0,
        item.totalQty - item.reservedQty - item.inUseQty - item.damagedQty,
      )
    : 0;
}

export function inventoryFromRows(rows: unknown[][]): InventoryItem[] {
  const items = new Map<string, InventoryItem>();
  for (const row of rows) {
    const itemId =
      typeof row[0] === 'string' ? row[0].trim().toUpperCase() : '';
    if (!/^EQ-\d{3,6}$/.test(itemId)) continue;
    try {
      const input = parseInventoryInput({
        name: row[1],
        category: row[2],
        totalQty: Number(row[3]) === 0 ? 1 : row[3],
        reservedQty: row[4],
        inUseQty: row[5],
        damagedQty: row[6],
        location: row[7],
        active: row[8] === true || row[8] === 'TRUE',
        notes: row[9],
        serialNumber: row[12],
        acquiredDate: row[13],
        specification: row[14],
        brand: row[15],
        model: row[16],
        condition: row[17] || 'good',
        warrantyExpiry: row[18],
        responsiblePerson: row[19],
        allocations: (() => {
          if (typeof row[20] !== 'string' || !row[20].trim()) return undefined;
          try { return JSON.parse(row[20]); } catch { return undefined; }
        })(),
      });
      items.set(itemId, {
        itemId,
        ...input,
        updatedAt: typeof row[10] === 'string' ? row[10] : '',
        updatedBy: typeof row[11] === 'string' ? row[11] : '',
      });
    } catch {
      /* Ignore malformed historical rows and keep the latest valid record. */
    }
  }
  return [...items.values()];
}

export function nextInventoryId(items: Pick<InventoryItem, 'itemId'>[]) {
  const next =
    items.reduce(
      (max, item) => Math.max(max, Number(item.itemId.slice(3)) || 0),
      0,
    ) + 1;
  return `EQ-${String(next).padStart(3, '0')}`;
}
