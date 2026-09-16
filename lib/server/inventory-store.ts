import {
  inventoryFromRows,
  nextInventoryId,
  parseInventoryInput,
  type InventoryItem,
} from '../inventory';
import { requiredEnv } from './env';
import { googleFetch } from './google';
import { AuthError } from './google-identity';

const INVENTORY_SHEET = 'Inventory';
const HEADERS = [
  'Item ID',
  'Name',
  'Category',
  'Total Qty',
  'Reserved Qty',
  'In Use Qty',
  'Damaged Qty',
  'Location',
  'Active',
  'Notes',
  'Changed At',
  'Changed By',
  'Serial Number',
  'Acquired Date',
  'Specification',
  'Brand',
  'Model',
  'Condition',
  'Warranty Expiry',
  'Responsible Person / Department',
];
const api = () =>
  `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(requiredEnv('GOOGLE_SHEET_ID'))}`;
let initialization: Promise<void> | undefined;

async function initializeInventory() {
  const metadata = await googleFetch(`${api()}?fields=sheets.properties.title`);
  const data = (await metadata.json()) as {
    sheets?: { properties: { title: string } }[];
  };
  if (
    !data.sheets?.some((sheet) => sheet.properties.title === INVENTORY_SHEET)
  ) {
    const sheetId =
      1_000_000 +
      (crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000_000);
    try {
      await googleFetch(`${api()}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  sheetId,
                  title: INVENTORY_SHEET,
                  gridProperties: { frozenRowCount: 1 },
                },
              },
            },
            {
              updateCells: {
                start: { sheetId, rowIndex: 0, columnIndex: 0 },
                rows: [
                  {
                    values: HEADERS.map((value) => ({
                      userEnteredValue: { stringValue: value },
                    })),
                  },
                ],
                fields: 'userEnteredValue',
              },
            },
          ],
        }),
      });
    } catch (error) {
      const retry = await googleFetch(
        `${api()}?fields=sheets.properties.title`,
      );
      const result = (await retry.json()) as {
        sheets?: { properties: { title: string } }[];
      };
      if (
        !result.sheets?.some(
          (sheet) => sheet.properties.title === INVENTORY_SHEET,
        )
      )
        throw error;
    }
  }
  await googleFetch(
    `${api()}/values/${encodeURIComponent(`'${INVENTORY_SHEET}'!A1:T1`)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [HEADERS] }),
    },
  );
}

async function ensureInventory() {
  initialization ??= initializeInventory().catch((error) => {
    initialization = undefined;
    throw error;
  });
  await initialization;
}

export async function listInventoryItems() {
  await ensureInventory();
  const response = await googleFetch(
    `${api()}/values/${encodeURIComponent(`'${INVENTORY_SHEET}'!A2:T`)}`,
  );
  const data = (await response.json()) as { values?: unknown[][] };
  return inventoryFromRows(data.values || []).sort(
    (a, b) =>
      Number(b.active) - Number(a.active) || a.itemId.localeCompare(b.itemId),
  );
}

export async function saveInventoryItem(
  raw: unknown,
  actor: string,
  create: boolean,
): Promise<InventoryItem> {
  const input = parseInventoryInput(raw);
  const items = await listInventoryItems();
  const requestedId =
    !create &&
    raw &&
    typeof raw === 'object' &&
    typeof (raw as Record<string, unknown>).itemId === 'string'
      ? (raw as Record<string, string>).itemId.trim().toUpperCase()
      : '';
  if (!create && !/^EQ-\d{3,6}$/.test(requestedId))
    throw new AuthError('លេខសម្គាល់សម្ភារៈមិនត្រឹមត្រូវ', 400);
  if (!create && !items.some((item) => item.itemId === requestedId))
    throw new AuthError('រកមិនឃើញសម្ភារៈនេះ', 404);
  if (
    input.serialNumber &&
    items.some(
      (item) =>
        item.itemId !== requestedId &&
        item.serialNumber.toLowerCase() === input.serialNumber.toLowerCase(),
    )
  )
    throw new AuthError('Serial Number នេះមានរួចហើយ', 409);
  const item: InventoryItem = {
    itemId: create ? nextInventoryId(items) : requestedId,
    ...input,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };
  await googleFetch(
    `${api()}/values/${encodeURIComponent(`'${INVENTORY_SHEET}'!A:T`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [
          [
            item.itemId,
            item.name,
            item.category,
            item.totalQty,
            item.reservedQty,
            item.inUseQty,
            item.damagedQty,
            item.location,
            item.active,
            item.notes,
            item.updatedAt,
            item.updatedBy,
            item.serialNumber,
            item.acquiredDate,
            item.specification,
            item.brand,
            item.model,
            item.condition,
            item.warrantyExpiry,
            item.responsiblePerson,
          ],
        ],
      }),
    },
  );
  return {
    ...item,
    totalQty: Number(item.totalQty),
    reservedQty: Number(item.reservedQty),
    inUseQty: Number(item.inUseQty),
    damagedQty: Number(item.damagedQty),
  };
}
