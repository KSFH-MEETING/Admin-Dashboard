export type InventoryItem = {
  itemId: string;
  name: string;
  category: string;
  serialNumber: string;
  acquiredDate: string;
  specification: string;
  totalQty: number;
  reservedQty: number;
  inUseQty: number;
  damagedQty: number;
  location: string;
  active: boolean;
  notes: string;
  updatedAt: string;
  updatedBy: string;
};

export type InventoryInput = Omit<
  InventoryItem,
  'itemId' | 'updatedAt' | 'updatedBy'
>;

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

function quantity(value: unknown, label: string) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 9999)
    throw new Error(`${label} ត្រូវជាលេខពេញចន្លោះ 0 ដល់ 9999`);
  return number;
}

export function parseInventoryInput(value: unknown): InventoryInput {
  if (!value || typeof value !== 'object') throw new Error('សូមបំពេញព័ត៌មានសម្ភារៈ');
  const data = value as Record<string, unknown>;
  const name = text(data.name, 100);
  const category = text(data.category, 60);
  const serialNumber = text(data.serialNumber, 100);
  const acquiredDate = text(data.acquiredDate, 10);
  const specification = text(data.specification, 1000);
  const location = text(data.location, 100);
  const notes = text(data.notes, 500);
  const totalQty = quantity(data.totalQty, 'ចំនួនសរុប');
  const reservedQty = quantity(data.reservedQty, 'ចំនួនបានកក់');
  const inUseQty = quantity(data.inUseQty, 'ចំនួនកំពុងប្រើ');
  const damagedQty = quantity(data.damagedQty, 'ចំនួនខូច');
  if (!name) throw new Error('សូមបញ្ចូលឈ្មោះសម្ភារៈ');
  if (!category) throw new Error('សូមបញ្ចូលប្រភេទសម្ភារៈ');
  if (!location) throw new Error('សូមជ្រើស ឬបញ្ចូលទីតាំងរក្សាទុក');
  if (acquiredDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(acquiredDate);
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
      throw new Error('ថ្ងៃទិញ / ទទួលមិនត្រឹមត្រូវ');
  }
  if (typeof data.active !== 'boolean') throw new Error('ស្ថានភាពសម្ភារៈមិនត្រឹមត្រូវ');
  if (reservedQty + inUseQty + damagedQty > totalQty)
    throw new Error('ចំនួនបានកក់ កំពុងប្រើ និងខូច មិនអាចលើសចំនួនសរុប');
  return {
    name,
    category,
    serialNumber,
    acquiredDate,
    specification,
    totalQty,
    reservedQty,
    inUseQty,
    damagedQty,
    location,
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
        totalQty: row[3],
        reservedQty: row[4],
        inUseQty: row[5],
        damagedQty: row[6],
        location: row[7],
        active: row[8] === true || row[8] === 'TRUE',
        notes: row[9],
        serialNumber: row[12],
        acquiredDate: row[13],
        specification: row[14],
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
